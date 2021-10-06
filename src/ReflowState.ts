// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0


import { Logger } from "tslog";
import ReflowOptions from "./ReflowOptions";

const log: Logger = new Logger({ name: "ReflowState" });

const Regexes = {
    // Markup that always ends a paragraph
    //   empty line or whitespace
    //   [block options]
    //   [[anchor]]
    //   //                  comment
    //   <<<<                page break
    //   :attribute-setting
    //   macro-directive::terms
    //   +                   standalone list item continuation
    //   label::             labelled list - label must be standalone
    endPara: /^( *|\[.*\]|\/\/.*|<<<<|:.*|[a-z]+::.*|\+|.*::)$/,

    // Special case of markup ending a paragraph, used to track the current
    // command/structure. This allows for either OpenXR or Vulkan API path
    // conventions. Nominally it should use the file suffix defined by the API
    // conventions (conventions.file_suffix), except that XR uses '.txt' for
    // generated API include files, not '.adoc' like its other includes.
    includePat: /include::(?<directory_traverse>((..\/){1,4}|\{INCS-VAR\}\/|\{generated\}\/)(generated\/)?)(?<generated_type>[\w]+)\/(?<category>\w+)\/(?<entity_name>[^./]+).txt[\[][\]]/,

    // Find the first pname: pattern in a Valid Usage statement
    pnamePat: /pname:(?<param>\w+)/,

    // Markup that's OK in a contiguous paragraph but otherwise passed through
    //   .anything
    //   === Section Titles
    //   image::path_to_image[attributes]  (apparently a single colon is OK but less idiomatic)
    endParaContinue: /^(\..*|=+ .+|image:.*\[.*\])$/,

    // Markup for block delimiters whose contents *should* be reformatted
    //   --   (exactly two)  (open block)
    //   **** (4 or more)    (sidebar block - works best/only? in AsciiDoctor 2)
    //   ==== (4 or more)    (example block)
    //   ____ (4 or more)    (quote block)
    blockReflow: /^(--|[*=_]{4,})$/,


    // Markup for block delimiters whose contents should *not* be reformatted
    //   |=== (3 or more)  (table)
    //   ++++ (4 or more)  (passthrough block)
    //   .... (4 or more)  (literal block)
    //   //// (4 or more)  (comment block)
    //   ---- (4 or more)  (listing block)
    //   ```  (3 or more)  (listing block)
    blockPassthrough: /^(\|={3,}|[`]{3}|[-.+/]{4,})$/,

    // Markup for introducing lists (hanging paragraphs)
    //   * bullet
    //     ** bullet
    //     -- bullet
    //   . bullet
    //   :: bullet (no longer supported by asciidoctor 2)
    //   {empty}:: bullet
    //   1. list item
    //   <1> source listing callout
    beginBullet: /^ *([-*.]+|\{empty\}::|::|[0-9]+[.]|<([0-9]+)>) /,

    // Text that (may) not end sentences

    // A single letter followed by a period, typically a middle initial.
    endInitial: /^[A-Z]\.$/,

    // An abbreviation, which doesn't (usually) end a line.
    endAbbrev: /(e\.g|i\.e|c\.f)\.$/i,

    // Explicit Valid Usage list item with one or more leading asterisks
    // The dotAll (s) is needed to prevent vuPat.exec() from stripping
    // the trailing newline.
    vuPat: /^(?<head>  [*]+)( *)(?<tail>.*)/s,

    // Pattern matching leading nested bullet points
    nestedVuPat: /^  \*\*/,
};

// Fake block delimiters for "common" VU statements
const blockCommonReflow = '// Common Valid Usage\n';

type BlockStackElement = string | null;

function truthyString(s: string | null) {
    if (s == null) {
        return false;
    }
    return (s.trim().length > 0);

}

// Returns whether oldname and newname match, up to an API suffix.
function apiMatch(oldname: string, newname: string): boolean {
    let trailingUpper = /[A-Z]+$/;
    return oldname.replace(trailingUpper, '') === newname.replace(trailingUpper, '');
}


export default class ReflowState {
    // The last element is a line with the asciidoc block delimiter that's currently in effect,
    // such as '--', '----', '****', '======', or '+++++++++'.
    // This affects whether or not the block contents should be formatted.
    private blockStack: BlockStackElement[] = [null];

    // The last element is true or false if the current blockStack contents
    // should be reflowed.
    private reflowStack: boolean[] = [true];

    // the last element is true or false if the current blockStack contents
    // are an explicit Valid Usage block.
    private vuStack: boolean[] = [false];

    // list of lines in the paragraph being accumulated.
    // When this is non-empty, there is a current paragraph.
    private para: string[] = [];

    // true if the previous line was a document title line
    // (e.g. :leveloffset: 0 - no attempt to track changes to this is made).
    lastTitle: boolean = false;

    // indent level (in spaces) of the first line of a paragraph.
    private leadIndent = 0;

    // indent level of the remaining lines of a paragraph.
    private hangIndent = 0;

    // line number being read from the input file.
    lineNumber = 0;

    // true if justification should break to a new line after
    // something that appears to be an initial in someone's name. **TBD**
    breakInitial: boolean = true;

    // Prefix of generated Valid Usage tags
    private vuPrefix: string = 'VUID';


    // margin to reflow text to.
    margin: number = 76;

    // true if justification should break to a new line after the end of a sentence.
    breakPeriod: boolean = true;

    // true if text should be reflowed, false to pass through unchanged.
    reflow: boolean = true;

    // Integer to start tagging un-numbered Valid Usage statements with,
    // or null if no tagging should be done.
    nextvu: number | null = null;

    // String name of a Vulkan structure or command for VUID tag generation,
    // or null if one hasn't been included in this file yet.
    private apiName: string | null = null;

    // All strings that get passed to printLines()
    private emittedText: string[] = [];

    // Line before the one we are processing
    private lastLine: string | null = null;

    constructor(options: ReflowOptions | null) {
        if (options !== null) {
            this.margin = options.margin;
            this.breakPeriod = options.breakPeriod;
            this.reflow = options.reflow;
            this.nextvu = options.nextvu;
            // must subtract 1 since first thing we do is add 1
            this.lineNumber = options.initialLineNumber - 1;
        }

    }

    // Return true if word ends with a sentence-period, false otherwise.
    //
    // Allows for contraction cases which won't end a line:
    //
    //  - A single letter (if breakInitial is true)
    //  - Abbreviations: 'c.f.', 'e.g.', 'i.e.' (or mixed-case versions)
    private endSentence(word: string) {
        return !(word.slice(-1) !== "." || Regexes.endAbbrev.test(word) || (this.breakInitial && Regexes.endInitial.test(word)));
    }

    // Return true if word is a Valid Usage ID Tag anchor.
    private vuidAnchor(word: string) {

        return (word.slice(0, 7) == '[[VUID-');
    }

    // Returns True if line is an open block delimiter.
    private isOpenBlockDelimiter(line: string): boolean {
        return line.slice(0, 2) === '--';
    }


    // Reflow the current paragraph, respecting the paragraph lead and
    // hanging indentation levels.

    // The algorithm also respects trailing '+' signs that indicate embedded newlines,
    // and will not reflow a very long word immediately after a bullet point.

    // Just return the paragraph unchanged if the -noflow argument was
    // given.
    private reflowPara() {
        if (!this.reflow) {
            return this.para
        }

        log.debug('reflowPara lead indent = ' + this.leadIndent +
            ' hangIndent = ' + this.hangIndent +
            ' para:' + this.para[0])

        // Total words processed (we care about the *first* word vs. others)
        let wordCount = 0;

        // Tracks the *previous* word processed. It must not be empty.
        let prevWord = ' ';
        let outLine: string | null = null;
        let outLineLen = 0;
        let outPara: string[] = [];
        for (const rawLine of this.para) {

            let line = rawLine.trimEnd();
            let words = line.length > 0 ? line.split(/[ \t]/) : [];

            // log.debug('reflowPara: input line =', line)
            let numWords = words.length - 1;

            let bulletPoint = false;

            for (const [i, word] of words.entries()) {
                let wordLen = word.length;
                wordCount += 1;

                let endEscape: string | boolean = false;
                if (i === numWords && word === '+') {
                    // Trailing ' +' must stay on the same line
                    endEscape = word
                    // log.debug('reflowPara last word of line =', word, 'prevWord =', prevWord, 'endEscape =', endEscape)
                } else {
                    // log.debug('reflowPara wordCount =', wordCount, 'word =', word, 'prevWord =', prevWord)

                }

                if (wordCount === 1) {

                    // The first word of the paragraph is treated specially.
                    // The loop logic becomes trickier if all this code is
                    // done prior to looping over lines and words, so all the
                    // setup logic is done here.

                    outPara = [];

                    if (this.leadIndent > 0) {
                        outLine = ' '.repeat(this.leadIndent);
                    } else {
                        outLine = '';
                    }
                    outLine += word;
                    outLineLen = this.leadIndent + wordLen;
                    // If the paragraph begins with a bullet point, generate
                    // a hanging indent level if there isn't one already.
                    if (Regexes.beginBullet.test(this.para[0])) {

                        bulletPoint = true;
                        if (this.para.length > 1) {
                            log.warn('reflowPara first line matches bullet point but indent already hanging @ input line ' + this.lineNumber)
                        } else {
                            log.warn('reflowPara first line matches bullet point - single line, assuming hangIndent @ input line ' + this.lineNumber);
                            this.hangIndent = outLineLen + 1
                        }
                    } else {
                        bulletPoint = false;
                    }
                } else {
                    // Possible actions to take with this word
                    //
                    // addWord - add word to current line
                    // closeLine - append line and start a new (null) one
                    // startLine - add word to a new line

                    // Default behavior if all the tests below fail is to add
                    // this word to the current line, and keep accumulating
                    // that line.
                    let actions = { addWord: true, closeLine: false, startLine: false };

                    // How long would this line be if the word were added?
                    let newLen = outLineLen + 1 + wordLen;

                    // Are we on the first word following a bullet point?
                    let firstBullet = (wordCount === 2 && bulletPoint);

                    if (endEscape) {
                        // If the new word ends the input line with ' +',
                        // add it to the current line.
                        actions = { addWord: true, closeLine: true, startLine: false };
                    } else if (this.vuidAnchor(word)) {
                        // If the new word is a Valid Usage anchor, break the
                        // line afterwards. Note that this should only happen
                        // immediately after a bullet point, but we don't
                        // currently check for this.
                        actions = { addWord: true, closeLine: true, startLine: false };
                    } else if (newLen > this.margin) {
                        if (firstBullet) {
                            // If the word follows a bullet point, add it to
                            // the current line no matter its length.
                            actions = { addWord: true, closeLine: true, startLine: false };
                        } else {
                            // The word overflows, so add it to a new line.
                            actions = { addWord: false, closeLine: true, startLine: true };
                        }
                    } else if (this.breakPeriod && (i > 1 || !firstBullet) && this.endSentence(prevWord)) {
                        // If the previous word ends a sentence and
                        // breakPeriod is set, start a new line.
                        // The complicated logic allows for leading bullet
                        // points which are periods (implicitly numbered lists).
                        // @@@ But not yet for explicitly numbered lists.
                        actions = { addWord: false, closeLine: true, startLine: true };
                    }

                    // Add a word to the current line
                    if (actions.addWord) {
                        if (truthyString(outLine)) {
                            outLine += ' ' + word;
                            outLineLen = newLen;
                        } else {
                        }
                    }

                    // Add current line to the output paragraph. Force
                    // starting a new line, although we don't yet know if it
                    // will ever have contents.
                    if (actions.closeLine) {
                        if (truthyString(outLine)) {
                            outPara.push(outLine + '\n');
                            outLine = null;
                        }
                    }

                    // Start a new line and add a word to it
                    if (actions.startLine) {
                        outLine = ' '.repeat(this.hangIndent) + word;
                        outLineLen = this.hangIndent + wordLen;
                    }
                }
                // Track the previous word, for use in breaking at end of
                // a sentence
                prevWord = word;

            }
        }
        // Add this line to the output paragraph.
        if (truthyString(outLine)) {
            outPara.push(outLine + '\n');
        }

        return outPara;
    }

    // Emit a paragraph, possibly reflowing it depending on the block context.
    //
    // Resets the paragraph accumulator.
    private emitPara() {
        if (this.para.length > 0) {
            let nextvu = this.nextvu;
            if (this.vuStack[this.vuStack.length - 1] && nextvu !== null) {
                // If:
                //   - this paragraph is in a Valid Usage block,
                //   - VUID tags are being assigned,
                // Try to assign VUIDs

                if (Regexes.nestedVuPat.test(this.para[0])) {
                    //                 // Check for nested bullet points. These should not be
                    //                 // assigned VUIDs, nor present at all, because they break
                    //                 // the VU extractor.
                    //                 log.warn(this.filename + ': Invalid nested bullet point in VU block: '+ this.para[0])
                } else if (this.para[0].search(this.vuPrefix) == -1) {
                    // If:
                    //   - a tag is not already present, and
                    //   - the paragraph is a properly marked-up list item
                    // Then add a VUID tag starting with the next free ID.

                    // Split the first line after the bullet point
                    let matches = this.para[0].match(Regexes.vuPat);
                    if (matches !== null && matches.groups !== null && matches.groups !== undefined) {

                        log.debug('findRefs: Matched vuPat on line: ' + this.para[0]);
                        let head = matches.groups['head'];
                        let tail = matches.groups['tail'];

                        // Use the first pname: statement in the paragraph as
                        // the parameter name in the VUID tag. This won't always
                        // be correct, but should be highly reliable.
                        let vuLineMatch: RegExpMatchArray | null = null;
                        for (let vuLine in this.para) {
                            vuLineMatch = vuLine.match(Regexes.pnamePat);
                            if (vuLineMatch !== null) {
                                break;
                            }
                        }
                        let paramName: string = 'None';
                        if (vuLineMatch !== null && vuLineMatch.groups !== null && vuLineMatch.groups !== undefined) {
                            paramName = vuLineMatch.groups['param'];
                        } else {
                            log.warn(
                                'No param name found for VUID tag on line: ' +
                                this.para[0])
                        }

                        let paddedNum = nextvu.toString().padStart(5, "0");
                        let newline = `${head} [[${this.vuPrefix}-${this.apiName}-${paramName}-${paddedNum}]] ${tail}`;
                        log.info(`Assigning ${this.vuPrefix} ${this.apiName} ${nextvu}  on line: ${this.para[0]} -> ${newline}`);

                        this.para[0] = newline;
                        this.nextvu = nextvu + 1;

                    }
                }

                // else:
                //     There are only a few cases of this, and they're all
                //     legitimate. Leave detecting this case to another tool
                //     or hand inspection.
                //     log.warn(this.filename + ': Unexpected non-bullet item in VU block (harmless if following an ifdef):',
                //             this.para[0])
            }
            if (this.reflowStack[this.reflowStack.length - 1]) {
                this.printLines(this.reflowPara());
            } else {
                this.printLines(this.para);
            }
        }

        // Reset the paragraph, including its indentation level
        this.para = [];
        this.leadIndent = 0;
        this.hangIndent = 0;
    }

    private incrLineNumber() {
        this.lineNumber += 1;
    }

    // Print an array of lines with newlines already present
    private printLines(lines: string[]) {
        /// TODO
        lines.forEach(line => {
            this.emittedText.push(line);
            // if (line.endsWith('\n')) {
            //     console.log(line.slice(0, -1));
            // } else {
            //     console.log(line);
            // }
        });
    }

    // 'line' ends a paragraph and should itthis be emitted.
    // line may be null to indicate EOF or other exception.
    private endPara(line: string | null) {
        log.debug('endPara line ' + this.lineNumber + ': emitting paragraph')

        // Emit current paragraph, this line, and reset tracker
        this.emitPara();

        if (line !== null) {
            this.printLines([line]);
        }
    }

    // 'line' ends a paragraph (unless there's already a paragraph being
    // accumulated, e.g. len(para) > 0 - currently not implemented)
    private endParaContinue(line: string) {
        this.endPara(line);
    }

    // 'line' begins or ends a block.
    private endBlock(line: string, reflow = false, vuBlock = false) {
        // def endBlock(this, line, reflow = false, vuBlock = false):

        // If beginning a block, tag whether or not to reflow the contents.

        // vuBlock is true if the previous line indicates this is a Valid Usage block.
        this.endPara(line)

        if (this.blockStack[this.blockStack.length - 1] === line) {
            log.debug('endBlock line ' + this.lineNumber +
                ': popping block end depth: ' + this.blockStack.length + ': ' + line);

            // Reset apiName at the end of an open block.
            // Open blocks cannot be nested, so this is safe.
            if (this.isOpenBlockDelimiter(line)) {
                log.debug('reset apiName to empty at line ' + this.lineNumber)
                this.apiName = ''
            } else {
                log.debug('NOT resetting apiName to empty at line ' + this.lineNumber)
            }
            this.blockStack.pop();
            this.reflowStack.pop();
            this.vuStack.pop();
        } else {

            // Start a block
            this.blockStack.push(line);
            this.reflowStack.push(reflow);
            this.vuStack.push(vuBlock);

            log.debug('endBlock reflow = ' + reflow + ' line ' + this.lineNumber +
                ': pushing block start depth '
                + this.blockStack.length + ': ' + line);
        }
    }
    // 'line' begins or ends a block. The paragraphs in the block *should* be
    // reformatted (e.g. a NOTE).
    private endParaBlockReflow(line: string, vuBlock: boolean) {
        // def endParaBlockReflow(this, line, vuBlock):
        this.endBlock(line, true, vuBlock = vuBlock);
    }

    // 'line' begins or ends a block. The paragraphs in the block should
    // *not* be reformatted (e.g. a code listing).
    private endParaBlockPassthrough(line: string) {
        this.endBlock(line, false);
    }

    // 'line' starts or continues a paragraph.
    //
    // Paragraphs may have "hanging indent", e.g.
    //
    // ```
    //   * Bullet point...
    //     ... continued
    // ```
    //
    // In this case, when the higher indentation level ends, so does the
    // paragraph.
    private addLine(line: string) {
        log.debug('addLine line ' + this.lineNumber + ': ' + line)

        let lineNoNewline = line.trimEnd();
        let indent = lineNoNewline.length - lineNoNewline.trimStart().length;

        // A hanging paragraph ends due to a less-indented line.
        if (this.para.length > 0 && indent < this.hangIndent) {
            log.debug('addLine: line reduces indentation, emit paragraph');
            this.emitPara();
        }

        // A bullet point (or something that looks like one) always ends the
        // current paragraph.
        if (Regexes.beginBullet.test(line)) {
            log.debug('addLine: line matches beginBullet, emit paragraph')
            this.emitPara();
        }
        if (this.para.length == 0) {
            // Begin a new paragraph
            this.para = [line];
            this.leadIndent = indent;
            this.hangIndent = indent;
        } else {
            // Add a line to a paragraph. Increase the hanging indentation
            // level - once.
            if (this.hangIndent == this.leadIndent) {
                this.hangIndent = indent;
            }
            this.para.push(line);
        }
    }

    // Process a single line of input
    processLine(line: string) {
        this.incrLineNumber();

        // Is this a title line (leading '= ' followed by text)?
        let thisTitle = false;

        // The logic here is broken. If we're in a non-reflowable block and
        // this line *doesn't* end the block, it should always be
        // accumulated.

        // Test for a blockCommonReflow delimiter comment first, to avoid
        // treating it solely as a end-Paragraph marker comment.
        if (line === blockCommonReflow) {
            // Starting or ending a pseudo-block for "common" VU statements.

            // Common VU statements use an Asciidoc variable as the apiName,
            // instead of inferring it from the most recent API include.
            this.apiName = '{refpage}'
            this.endParaBlockReflow(line, true);
        } else if (Regexes.blockReflow.test(line)) {

            // Starting or ending a block whose contents may be reflowed.
            // Blocks cannot be nested.

            // Is this is an explicit Valid Usage block?
            let vuBlock = (this.lineNumber > 1 &&
                this.lastLine === '.Valid Usage\n');

            this.endParaBlockReflow(line, vuBlock);
        } else if (Regexes.endPara.test(line)) {
            // Ending a paragraph. Emit the current paragraph, if any, and
            // prepare to begin a new paragraph.

            this.endPara(line)

            // If this is an include:: line starting the definition of a
            // structure or command, track that for use in VUID generation.

            let matches = line.match(Regexes.includePat);
            if (matches !== null && matches.groups != null) {

                //         if matches is not None:
                let generated_type = matches.groups['generated_type'];
                let include_type = matches.groups['category'];
                if (generated_type === 'api' && (include_type === 'protos' || include_type === 'structs')) {
                    let apiName = matches.groups['entity_name'];
                    if (this.apiName !== '' && this.apiName !== null) {
                        // This happens when there are multiple API include
                        // lines in a single block. The style guideline is to
                        // always place the API which others are promoted to
                        // first. In virtually all cases, the promoted API
                        // will differ solely in the vendor suffix (or
                        // absence of it), which is benign.
                        if (!apiMatch(this.apiName, apiName)) {
                            log.warn(`Promoted API name mismatch at line ${this.lineNumber}: apiName: ${apiName} does not match this.apiName: ${this.apiName}`);
                        }
                    } else {
                        this.apiName = apiName
                    }
                }

            }
        } else if (Regexes.endParaContinue.test(line)) {
            // For now, always just end the paragraph.
            // Could check see if len(para) > 0 to accumulate.

            this.endParaContinue(line);

            // If it's a title line, track that
            if (line.slice(0, 2) === '= ') {
                thisTitle = true;
            }
        } else if (Regexes.blockPassthrough.test(line)) {
            // Starting or ending a block whose contents must not be reflowed.
            // These are tables, etc. Blocks cannot be nested.

            this.endParaBlockPassthrough(line);
        } else if (this.lastTitle) {
            // The previous line was a document title line. This line
            // is the author / credits line and must not be reflowed.

            this.endPara(line)
        } else {
            // Just accumulate a line to the current paragraph. Watch out for
            // hanging indents / bullet-points and track that indent level.

            this.addLine(line);
        }
        this.lastTitle = thisTitle;
        this.lastLine = line;

    }

    // Process all lines of a file or segment
    //
    // Calls endInput for you()
    processLines(lines: string[]) {
        lines.forEach(line => {
            this.processLine(line);
        });

        this.endInput();
    }

    // Clean up after processing all lines of input.
    endInput() {
        // Cleanup at end of file
        this.endPara(null);

        // Check block nesting
        if (this.blockStack.length > 1) {
            log.warn(`mismatched asciidoc block delimiters at EOF: ${this.blockStack[-1]}`);
        }
    }

    // Gets the output
    getEmittedText(): string {
        return this.emittedText.join('');
    }
}
