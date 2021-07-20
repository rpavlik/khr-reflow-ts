import { Logger } from "tslog";

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
    includePat: /include::(?P<directory_traverse>((..\/){1,4}|\{INCS-VAR\}\/|\{generated\}\/)(generated\/)?)(?P<generated_type>[\w]+)\/(?P<category>\w+)\/(?P<entity_name>[^./]+).txt[\[][\]]/,

    // Find the first pname: pattern in a Valid Usage statement
    pnamePat: /pname:(?P<param>\w+)/,

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
};

// Fake block delimiters for "common" VU statements
const blockCommonReflow = '// Common Valid Usage\n';
type BlockStackElement = string | null;

function truthyString(s: string?) {
    if (s == null) {
        return false;
    }
    return (s.trim().length > 0);

}

class ReflowState {
    // The last element is a line with the asciidoc block delimiter that's currently in effect,
    // such as '--', '----', '****', '======', or '+++++++++'.
    // This affects whether or not the block contents should be formatted.
    blockStack: BlockStackElement[] = [null];

    // The last element is true or false if the current blockStack contents
    // should be reflowed.
    reflowStack: boolean[] = [true];
    // the last element is true or false if the current blockStack contents
    // are an explicit Valid Usage block.
    vuStack: boolean[] = [false];

    // list of lines in the paragraph being accumulated.
    // When this is non-empty, there is a current paragraph.
    para: string[] = [];

    // true if the previous line was a document title line
    // (e.g. :leveloffset: 0 - no attempt to track changes to this is made).
    lastTitle: boolean = false;

    // indent level (in spaces) of the first line of a paragraph.
    leadIndent = 0;

    // indent level of the remaining lines of a paragraph.
    hangIndent = 0;

    // line number being read from the input file.
    lineNumber = 0;

    // true if justification should break to a new line after
    // something that appears to be an initial in someone's name. **TBD**
    breakInitial = true;

    // Prefix of generated Valid Usage tags
    vuPrefix: string = 'VUID';

    // Format string for generating Valid Usage tags.
    // First argument is vuPrefix, second is command/struct name, third is parameter name, fourth is the tag number.
    vuFormat: string = '{0}-{1}-{2}-{3:0>5d}';

    // margin to reflow text to.
    margin = 76;

    // true if justification should break to a new line after the end of a sentence.
    breakPeriod = true;

    // true if text should be reflowed, false to pass through unchanged.
    reflow = true;

    // Integer to start tagging un-numbered Valid Usage statements with,
    // or null if no tagging should be done.
    nextvu = null;

    // String name of a Vulkan structure or command for VUID tag generation,
    // or null if one hasn't been included in this file yet.
    apiName: string = '';


    constructor(
        margin = 76,
        breakPeriod = true,
        reflow = true,
        nextvu = null) {

        this.margin = margin;

        this.breakPeriod = breakPeriod;

        this.reflow = reflow;

        this.nextvu = nextvu;

    }

    // Return true if word ends with a sentence-period, false otherwise.
    //
    // Allows for contraction cases which won't end a line:
    //
    //  - A single letter (if breakInitial is true)
    //  - Abbreviations: 'c.f.', 'e.g.', 'i.e.' (or mixed-case versions)
    endSentence(word: string) {
        return !(word.slice(-1) !== "." || Regexes.endAbbrev.exec(word) || (this.breakInitial && Regexes.endInitial.exec(word)));
    }

    // Return true if word is a Valid Usage ID Tag anchor.
    vuidAnchor(word: string) {

        return (word.slice(0, 7) == '[[VUID-');
    }


    // Reflow the current paragraph, respecting the paragraph lead and
    // hanging indentation levels.

    // The algorithm also respects trailing '+' signs that indicate embedded newlines,
    // and will not reflow a very long word immediately after a bullet point.

    // Just return the paragraph unchanged if the -noflow argument was
    // given.
    reflowPara() {
        if (!this.reflow) {
            return this.para
        }

        log.info('reflowPara lead indent = ' + this.leadIndent +
            'hangIndent =' + this.hangIndent +
            'para:' + this.para[0])

        // Total words processed (we care about the *first* word vs. others)
        let wordCount = 0;

        // Tracks the *previous* word processed. It must not be empty.
        let prevWord = ' ';
        let outLine: string?= null;
        let outPara: string[] = [];
        //import pdb; pdb.set_trace()
        this.para.forEach(line => {
            line = line.trimEnd();
            let words = line.split(/[ \t]/);

            // log.info('reflowPara: input line =', line)
            let numWords = words.length - 1;

            let outLineLen = 0;
            let bulletPoint = false;
            let startLine = false;

            for (let i = 0; i < numWords + 1; i++) {
                let word = words[i];
                let wordLen = word.length;
                wordCount += 1;

                let endEscape: string | boolean = false;
                if (i === numWords && word === '+') {
                    // Trailing ' +' must stay on the same line
                    endEscape = word
                    // log.info('reflowPara last word of line =', word, 'prevWord =', prevWord, 'endEscape =', endEscape)
                } else {
                    // log.info('reflowPara wordCount =', wordCount, 'word =', word, 'prevWord =', prevWord)

                }

                if (wordCount === 1) {

                    // The first word of the paragraph is treated specially.
                    // The loop logic becomes trickier if all this code is
                    // done prior to looping over lines and words, so all the
                    // setup logic is done here.

                    outPara = [];

                    outLine = ' '.repeat(this.leadIndent) + word;
                    outLineLen = this.leadIndent + wordLen;
                    // If the paragraph begins with a bullet point, generate
                    // a hanging indent level if there isn't one already.
                    if (Regexes.beginBullet.exec(this.para[0])) {

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
                    } else if (this.breakPeriod &&
                        (wordCount > 2 || !firstBullet) &&
                        this.endSentence(prevWord)) {
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
                            // Fall through to startLine case if there's no
                            // current line yet.
                            startLine = true;
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
        });
        // Add this line to the output paragraph.
        if (truthyString(outLine)) {
            outPara.push(outLine + '\n');
        }

        return outPara;
    }

    // Emit a paragraph, possibly reflowing it depending on the block context.
    //
    // Resets the paragraph accumulator.
    emitPara(): string[] {
        // def emitPara(this):
        let result: string[] = [];
        if (this.para.length > 0) {
            /// Skipping VU assignment code
            //         if this.vuStack[-1] and this.nextvu is not None:
            //             // If:
            //             //   - this paragraph is in a Valid Usage block,
            //             //   - VUID tags are being assigned,
            //             // Try to assign VUIDs

            //             if nestedVuPat.search(this.para[0]):
            //                 // Check for nested bullet points. These should not be
            //                 // assigned VUIDs, nor present at all, because they break
            //                 // the VU extractor.
            //                 log.warn(this.filename + ': Invalid nested bullet point in VU block: '+ this.para[0])
            //             elif this.vuPrefix not in this.para[0]:
            //                 // If:
            //                 //   - a tag is not already present, and
            //                 //   - the paragraph is a properly marked-up list item
            //                 // Then add a VUID tag starting with the next free ID.

            //                 // Split the first line after the bullet point
            //                 matches = vuPat.search(this.para[0])
            //                 if matches is not None:
            //                     log.info('findRefs: Matched vuPat on line: ' + this.para[0])
            //                     head = matches.group('head')
            //                     tail = matches.group('tail')

            //                     // Use the first pname: statement in the paragraph as
            //                     // the parameter name in the VUID tag. This won't always
            //                     // be correct, but should be highly reliable.
            //                     for vuLine in this.para:
            //                         matches = pnamePat.search(vuLine)
            //                         if matches is not None:
            //                             break

            //                     if matches is not None:
            //                         paramName = matches.group('param')
            //                     else:
            //                         paramName = 'None'
            //                         log.warn(this.filename + 
            //                                 ' No param name found for VUID tag on line: ' +
            //                                 this.para[0])

            //                     newline = (head + ' [[' +
            //                                this.vuFormat.format(this.vuPrefix,
            //                                                     this.apiName,
            //                                                     paramName,
            //                                                     this.nextvu) + ']] ' + tail)

            //                     log.info('Assigning', this.vuPrefix, this.apiName, this.nextvu,
            //                             ' on line:', this.para[0], '->', newline, 'END')

            //                     this.para[0] = newline
            //                     this.nextvu = this.nextvu + 1
            //             // else:
            //             //     There are only a few cases of this, and they're all
            //             //     legitimate. Leave detecting this case to another tool
            //             //     or hand inspection.
            //             //     log.warn(this.filename + ': Unexpected non-bullet item in VU block (harmless if following an ifdef):',
            //             //             this.para[0])

            if (this.reflowStack[this.reflowStack.length - 1]) {
                result = this.reflowPara();
            } else {
                result = this.para;
            }
        }

        // Reset the paragraph, including its indentation level
        this.para = [];
        this.leadIndent = 0;
        this.hangIndent = 0;
        return result;
    }

    
}
