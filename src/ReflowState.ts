// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import { Logger } from "tslog";
import ReflowOptions from "./ReflowOptions";
import REFLOW_REGEXES from "./Regexes";

const log = new Logger({ name: "ReflowState" });

// Fake block delimiters for "common" VU statements
const blockCommonReflow = "// Common Valid Usage\n";

type BlockStackElement = string | null;

/** Returns whether oldname and newname match, up to an API suffix. */
function apiMatch(oldname: string, newname: string): boolean {
  const trailingUpper = /[A-Z]+$/;
  return oldname.replace(trailingUpper, "") === newname.replace(trailingUpper, "");
}

/**
 * The state of a reflow operation.
 *
 * Can be used for incremental reflows, etc.
 */
export default class ReflowState {
  /**
   * The last element is a line with the asciidoc block delimiter that's currently in effect,
   * such as '--', '----', '****', '======', or '+++++++++'.
   * This affects whether or not the block contents should be formatted.
   */
  private blockStack: BlockStackElement[] = [null];

  /**
   * The last element is true or false if the current blockStack contents
   * should be reflowed.
   */
  private reflowStack: boolean[] = [true];

  /**
   * the last element is true or false if the current blockStack contents
   * are an explicit Valid Usage block.
   */
  private vuStack: boolean[] = [false];

  /**
   * list of lines in the paragraph being accumulated.
   * When this is non-empty, there is a current paragraph.
   */
  private para: string[] = [];

  /**
   * true if the previous line was a document title line
   * (e.g. :leveloffset: 0 - no attempt to track changes to this is made).
   */
  private lastTitle = false;

  /** indent level (in spaces) of the first line of a paragraph. */
  private leadIndent = 0;

  /** indent level of the remaining lines of a paragraph. */
  private hangIndent = 0;

  /** line number being read from the input file. */
  private lineNumber = 0;

  /**
   * true if justification should break to a new line after something
   * that appears to be an initial in someone's name. **TBD**
   * */
  private breakInitial = true;

  /** Prefix of generated Valid Usage tags */
  private vuPrefix = "VUID";

  /** margin to reflow text to. */
  private margin = 76;

  /**  true if justification should break to a new line after the end of a sentence. */
  private breakPeriod = true;

  /**  true if text should be reflowed, false to pass through unchanged.*/
  private reflow = true;

  /**
   * Integer to start tagging un-numbered Valid Usage statements with,
   * or null if no tagging should be done.
   */
  private nextvu: number | null = null;

  /**
   * String name of a Vulkan structure or command for VUID tag generation, or null if one hasn't been included in this file yet.
   */
  private apiName: string | null = null;

  /** All strings that get passed to printLines() */
  private emittedText: string[] = [];

  /** Line before the one we are processing */
  private lastLine: string | null = null;

  public constructor(options?: ReflowOptions) {
    if (options !== undefined) {
      this.margin = options.margin;
      this.breakPeriod = options.breakPeriod;
      this.reflow = options.reflow;
      this.nextvu = options.nextvu;
      // must subtract 1 since first thing we do is add 1
      this.lineNumber = options.initialLineNumber - 1;
    }
  }

  /**
   * Return true if word ends with a sentence-period, false otherwise.
   *
   * Allows for contraction cases which won't end a line:
   *
   * - A single letter (if breakInitial is true)
   * - Abbreviations: 'c.f.', 'e.g.', 'i.e.' (or mixed-case versions)
   *
   * @param word a word
   * @returns true if this word ends the sentence.
   */
  private endSentence(word: string) {
    return !(
      word.slice(-1) !== "." ||
      REFLOW_REGEXES.endAbbrev.test(word) ||
      (this.breakInitial && REFLOW_REGEXES.endInitial.test(word))
    );
  }

  // Return true if word is a Valid Usage ID Tag anchor.
  private vuidAnchor(word: string) {
    return word.slice(0, 7) === "[[VUID-";
  }

  // Returns True if line is an open block delimiter.
  private isOpenBlockDelimiter(line: string): boolean {
    return line.slice(0, 2) === "--";
  }

  /**
   * Reflow the current paragraph (if reflowing was not disabled),
   * respecting the paragraph lead and hanging indentation levels.
   *
   * The algorithm also respects trailing '+' signs that indicate embedded newlines,
   * and will not reflow a very long word immediately after a bullet point.
   *
   * @returns array of possibly-reflowed lines with trailing newlines.
   */
  private reflowPara(): string[] {
    if (!this.reflow) {
      return this.para;
    }

    log.debug("lead indent = " + this.leadIndent + " hangIndent = " + this.hangIndent + " para:" + this.para[0]);

    // Total words processed (we care about the *first* word vs. others)
    let paragraphWordCount = 0;

    // Tracks the *previous* word processed. It must not be empty.
    let prevWord = " ";
    const outLineBuf = new OutLineBuffer();
    let outPara: string[] = [];
    for (const rawLine of this.para) {
      // let line = rawLine.trimEnd();
      // let words = line.length > 0 ? line.split(/[ \t]/) : [];
      const words = trimAndSplitLine(rawLine);

      // log.debug('reflowPara: input line =', line)
      const numWords = words.length - 1;

      // Trailing ' +' must stay on the same line
      const endEscapeLine = getEndEscape(words);
      const bulletPoint = this.paraBeginsWithBullet;

      for (const [i, word] of words.entries()) {
        const wordLen = word.length;
        paragraphWordCount += 1;

        const isLastWordOfLine = i === numWords;
        const isFirstWordOfParagraph = paragraphWordCount === 1;

        if (isFirstWordOfParagraph) {
          // The first word of the paragraph is treated specially.
          // The loop logic becomes trickier if all this code is
          // done prior to looping over lines and words, so all the
          // setup logic is done here.

          outPara = [];

          outLineBuf.indent = this.leadIndent;
          outLineBuf.push(word);

          // If the paragraph begins with a bullet point, generate
          // a hanging indent level if there isn't one already.
          if (bulletPoint) {
            if (this.para.length > 1) {
              log.warn(
                "reflowPara first line matches bullet point but indent already hanging @ input line " + this.lineNumber
              );
            } else {
              log.warn(
                "reflowPara first line matches bullet point - single line, assuming hangIndent @ input line " +
                  this.lineNumber
              );
              this.hangIndent = outLineBuf.length + 1;
            }
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
          const newLen = outLineBuf.length + 1 + wordLen;

          // Are we on the first word following a bullet point?
          const firstBullet = paragraphWordCount === 2 && bulletPoint;

          if (isLastWordOfLine && endEscapeLine) {
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
            if (outLineBuf.isEmpty()) {
              actions.startLine = true;
            } else {
              outLineBuf.push(word);
            }
          }

          // Add current line to the output paragraph. Force
          // starting a new line, although we don't yet know if it
          // will ever have contents.
          if (actions.closeLine) {
            if (!outLineBuf.isEmpty()) {
              outPara.push(outLineBuf.line + "\n");
              outLineBuf.reset();
            }
          }

          // Start a new line and add a word to it
          if (actions.startLine) {
            if (!outLineBuf.isEmpty()) {
              throw new Error("unexpected");
            }
            outLineBuf.indent = this.hangIndent;
            outLineBuf.push(word);
          }
        }
        // Track the previous word, for use in breaking at end of
        // a sentence
        prevWord = word;
      }
    }
    // Add this line to the output paragraph.
    if (!outLineBuf.isEmpty()) {
      outPara.push(outLineBuf.line + "\n");
    }

    return outPara;
  }

  /**
   * Emit a paragraph, possibly reflowing it depending on the block context.
   *
   * Resets the paragraph accumulator.
   */
  private emitPara() {
    if (this.para.length > 0) {
      const nextvu = this.nextvu;
      if (this.vuStack[this.vuStack.length - 1] && nextvu !== null) {
        // If:
        //   - this paragraph is in a Valid Usage block,
        //   - VUID tags are being assigned,
        // Try to assign VUIDs

        if (REFLOW_REGEXES.nestedVuPat.test(this.para[0])) {
          // Check for nested bullet points. These should not be
          // assigned VUIDs, nor present at all, because they break
          // the VU extractor.
          // log.warn(this.filename + ": Invalid nested bullet point in VU block: " + this.para[0]);
        } else if (this.para[0].search(this.vuPrefix) === -1) {
          // If:
          //   - a tag is not already present, and
          //   - the paragraph is a properly marked-up list item
          // Then add a VUID tag starting with the next free ID.

          // Split the first line after the bullet point
          const matches = this.para[0].match(REFLOW_REGEXES.vuPat);
          if (matches !== null && matches.groups !== null && matches.groups !== undefined) {
            log.debug("findRefs: Matched vuPat on line: " + this.para[0]);
            const head = matches.groups["head"];
            const tail = matches.groups["tail"];

            // Use the first pname: statement in the paragraph as
            // the parameter name in the VUID tag. This won't always
            // be correct, but should be highly reliable.
            let vuLineMatch: RegExpMatchArray | null = null;
            for (const vuLine in this.para) {
              vuLineMatch = vuLine.match(REFLOW_REGEXES.pnamePat);
              if (vuLineMatch !== null) {
                break;
              }
            }
            let paramName = "None";
            if (vuLineMatch !== null && vuLineMatch.groups !== null && vuLineMatch.groups !== undefined) {
              paramName = vuLineMatch.groups["param"];
            } else {
              log.warn("No param name found for VUID tag on line: " + this.para[0]);
            }

            const paddedNum = nextvu.toString().padStart(5, "0");
            const newline = `${head} [[${this.vuPrefix}-${this.apiName}-${paramName}-${paddedNum}]] ${tail}`;
            log.info(`Assigning ${this.vuPrefix} ${this.apiName} ${nextvu}  on line: ${this.para[0]} -> ${newline}`);

            this.para[0] = newline;
            this.nextvu = nextvu + 1;
          }
        }
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

  /** Print an array of lines with newlines already present */
  private printLines(lines: string[]) {
    for (const line of lines) {
      this.emittedText.push(line);
    }
  }

  /**
   * 'line' ends a paragraph and the state should be emitted.
   *
   * @param line line of text including trailing line ending, or null to indicate EOF or other exception.
   */
  private endPara(line: string | null) {
    log.debug("endPara line " + this.lineNumber + ": emitting paragraph");

    // Emit current paragraph, this line, and reset tracker
    this.emitPara();

    if (line !== null) {
      this.printLines([line]);
    }
  }

  /**
   * 'line' ends a paragraph (unless there's already a paragraph being
   * accumulated, e.g. len(para) > 0 - currently not implemented)
   *
   * @param line line of text including trailing line ending.
   */
  private endParaContinue(line: string) {
    this.endPara(line);
  }

  /**
   * 'line' begins or ends a block.
   *
   * @param line line of text including trailing line ending.
   * @param reflow whether the block should be reflowed
   * @param vuBlock whether or not this is a valid usage block
   */
  private endBlock(line: string, reflow = false, vuBlock = false): void {
    // If beginning a block, tag whether or not to reflow the contents.

    // vuBlock is true if the previous line indicates this is a Valid Usage block.
    this.endPara(line);

    if (this.blockStack[this.blockStack.length - 1] === line) {
      log.debug(
        "endBlock line " + this.lineNumber + ": popping block end depth: " + this.blockStack.length + ": " + line
      );

      // Reset apiName at the end of an open block.
      // Open blocks cannot be nested, so this is safe.
      if (this.isOpenBlockDelimiter(line)) {
        log.debug("reset apiName to empty at line " + this.lineNumber);
        this.apiName = "";
      } else {
        log.debug("NOT resetting apiName to empty at line " + this.lineNumber);
      }
      this.blockStack.pop();
      this.reflowStack.pop();
      this.vuStack.pop();
    } else {
      // Start a block
      this.blockStack.push(line);
      this.reflowStack.push(reflow);
      this.vuStack.push(vuBlock);

      log.debug(
        "endBlock reflow = " +
          reflow +
          " line " +
          this.lineNumber +
          ": pushing block start depth " +
          this.blockStack.length +
          ": " +
          line
      );
    }
  }

  /**
   * 'line' begins or ends a block. The paragraphs in the block *should* be reformatted (e.g. a NOTE).
   *
   * @param line line including trailing line ending.
   * @param vuBlock whether or not this is a valid usage block
   */
  private endParaBlockReflow(line: string, vuBlock: boolean) {
    // def endParaBlockReflow(this, line, vuBlock):
    this.endBlock(line, true, vuBlock);
  }

  /**
   * 'line' begins or ends a block. The paragraphs in the block should *not* be reformatted (e.g. a code listing).
   *
   * @param line line including trailing line ending.
   */
  private endParaBlockPassthrough(line: string) {
    this.endBlock(line, false);
  }

  /**
   * 'line' starts or continues a paragraph.
   *
   * @param line line including trailing line ending.
   *
   * Paragraphs may have "hanging indent", e.g.
   *
   * ```
   *   * Bullet point...
   *     ... continued
   * ```
   *
   * In this case, when the higher indentation level ends, so does the
   * paragraph.
   */
  private addLine(line: string) {
    log.debug("addLine line " + this.lineNumber + ": " + line);

    const lineNoNewline = line.trimEnd();
    const indent = lineNoNewline.length - lineNoNewline.trimStart().length;

    // A hanging paragraph ends due to a less-indented line.
    if (this.para.length > 0 && indent < this.hangIndent) {
      log.debug("addLine: line reduces indentation, emit paragraph");
      this.emitPara();
    }

    // A bullet point (or something that looks like one) always ends the
    // current paragraph.
    if (REFLOW_REGEXES.beginBullet.test(line)) {
      log.debug("addLine: line matches beginBullet, emit paragraph");
      this.emitPara();
    }
    if (this.para.length === 0) {
      // Begin a new paragraph
      this.para = [line];
      this.leadIndent = indent;
      this.hangIndent = indent;
    } else {
      // Add a line to a paragraph. Increase the hanging indentation
      // level - once.
      if (this.hangIndent === this.leadIndent) {
        this.hangIndent = indent;
      }
      this.para.push(line);
    }
  }

  /**
   * Process a single line of input
   *
   * Line number will be automatically incremented.
   *
   * @param line line including trailing line ending.
   */
  public processLine(line: string): void {
    this.processNumberedLine(line, this.lineNumber + 1);
  }

  // Process a single line of input for which you know the line number
  public processNumberedLine(line: string, lineNumber: number): void {
    this.lineNumber = lineNumber;

    const trimmed = line.trimEnd();
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
      this.apiName = "{refpage}";
      this.endParaBlockReflow(line, true);
    } else if (REFLOW_REGEXES.blockReflow.test(trimmed)) {
      // Starting or ending a block whose contents may be reflowed.
      // Blocks cannot be nested.

      // Is this is an explicit Valid Usage block?
      const vuBlock = this.lineNumber > 1 && this.lastLine === ".Valid Usage\n";

      this.endParaBlockReflow(line, vuBlock);
    } else if (REFLOW_REGEXES.endPara.test(trimmed)) {
      // Ending a paragraph. Emit the current paragraph, if any, and
      // prepare to begin a new paragraph.

      this.endPara(line);

      // If this is an include:: line starting the definition of a
      // structure or command, track that for use in VUID generation.

      const matches = line.match(REFLOW_REGEXES.includePat);
      if (matches && matches.groups) {
        //         if matches is not None:
        const generatedType = matches.groups["generated_type"];
        const includeType = matches.groups["category"];
        if (generatedType === "api" && (includeType === "protos" || includeType === "structs")) {
          const apiName = matches.groups["entity_name"];
          if (this.apiName !== "" && this.apiName !== null) {
            // This happens when there are multiple API include
            // lines in a single block. The style guideline is to
            // always place the API which others are promoted to
            // first. In virtually all cases, the promoted API
            // will differ solely in the vendor suffix (or
            // absence of it), which is benign.
            if (!apiMatch(this.apiName, apiName)) {
              log.warn(
                `Promoted API name mismatch at line ${this.lineNumber}: apiName: ${apiName} does not match this.apiName: ${this.apiName}`
              );
            }
          } else {
            this.apiName = apiName;
          }
        }
      }
    } else if (REFLOW_REGEXES.endParaContinue.test(trimmed)) {
      // For now, always just end the paragraph.
      // Could check see if len(para) > 0 to accumulate.

      this.endParaContinue(line);

      // If it's a title line, track that
      if (line.slice(0, 2) === "= ") {
        thisTitle = true;
      }
    } else if (REFLOW_REGEXES.blockPassthrough.test(trimmed)) {
      // Starting or ending a block whose contents must not be reflowed.
      // These are tables, etc. Blocks cannot be nested.

      this.endParaBlockPassthrough(line);
    } else if (this.lastTitle) {
      // The previous line was a document title line. This line
      // is the author / credits line and must not be reflowed.

      this.endPara(line);
    } else {
      // Just accumulate a line to the current paragraph. Watch out for
      // hanging indents / bullet-points and track that indent level.

      this.addLine(line);
    }
    this.lastTitle = thisTitle;
    this.lastLine = line;
  }

  /** Returns true if endInput() would essentially be a no-op. */
  public isBetweenParagraphs(): boolean {
    return (this.para === null || this.para.length === 0) && this.blockStack.length === 1 && this.vuStack.length === 1;
  }

  /**
   * Process all lines of a file or segment.
   *
   * Automatically increments line number.
   *
   * Calls endInput for you()
   *
   * @param lines array of lines, each with their own trailing line ending
   *
   * @deprecated Use processLinesAndEndInput() instead.
   */
  public processLines(lines: string[]): void {
    this.processLinesAndEndInput(lines);
  }

  /**
   * Process all lines of a file or segment
   *
   * Automatically increments line number.
   *
   *
   * Calls endInput for you()
   *
   * @param lines array of lines, each with their own trailing line ending
   */
  public processLinesAndEndInput(lines: string[]): void {
    for (const line of lines) {
      console.log("Processing: " + line);
      this.processLine(line);
    }

    this.endInput();
  }

  /**
   * Clean up after processing all lines of input.
   *
   * Ends any paragraphs in progress.
   */
  public endInput(): void {
    // Cleanup at end of file
    this.endPara(null);

    // Check block nesting
    if (this.blockStack.length > 1) {
      log.warn(`mismatched asciidoc block delimiters at EOF: ${this.blockStack[-1]}`);
    }
  }

  //
  /**
   * Gets the output.
   *
   * @returns a string of all the formatted output
   */
  public getEmittedText(): string {
    return this.emittedText.join("");
  }

  /**
   * Gets the output lines.
   *
   * @returns an array of all the formatted lines, with their trailing newline.
   */
  public getEmittedLines(): string[] {
    return this.emittedText;
  }

  /**
   * Clears the emitted lines so we can use this incrementally.
   */
  public clearEmittedText(): void {
    this.emittedText = [];
  }

  private get paraBeginsWithBullet(): boolean {
    if (REFLOW_REGEXES.beginBullet.test(this.para[0])) {
      return true;
    }
    return false;
  }
}

/**
 * Identifies if the words in this line have an escaped newline at the end
 *
 * @param lineWords An array of words (whitespace-delimited tokens)
 * @returns "+" if the last word in the line is + indicating an escaped newline, null otherwise.
 */
function getEndEscape(lineWords: string[]): "+" | null {
  if (lineWords.length > 0) {
    const lastWord = lineWords[lineWords.length - 1];
    if (lastWord === "+") {
      return lastWord;
    }
  }
  return null;
}

/**
 * Trim a raw line and split into words on whitespace
 *
 * @param rawLine Line of text including trailing line endings
 * @returns the input split on spaces and tabs,
 * or an empty array if the input was empty after leading/trailing whitespace was trimmed.
 */
function trimAndSplitLine(rawLine: string) {
  const line = rawLine.trim();
  return line.length > 0 ? line.split(/[ \t]/) : [];
}

/**
 * Tracks adding words to a line, with possible indentation,
 * to know when to insert a line break.
 */
class OutLineBuffer {
  private outLineWords: string[] = [];
  private _indent = 0;

  /**
   * Spaces of indentation.
   */
  public get indent() {
    return this._indent;
  }
  /**
   * Set the spaces of indentation
   */
  public set indent(theIndent: number) {
    if (theIndent < 0) {
      throw new Error("Negative indent not allowed");
    }
    this._indent = theIndent;
  }

  /**
   * Characters length, including indentation, all words, and spaces between words.
   *
   * Does not include any trailing whitespace/line endings.
   */
  public get length(): number {
    // all word lengths combined
    const wordCharacters = this.outLineWords
      .map((s) => {
        return s.length;
      })
      .reduce((sum, len) => {
        return sum + len;
      }, 0);
    // spaces between words
    const spaces = Math.max(0, this.outLineWords.length - 1);
    return this.indent + wordCharacters + spaces;
  }

  /**
   * The line as buffered so far, with leading spaces for indent (if required),
   * and all words separated by a single space.
   *
   * No trailing line endings.
   */
  public get line(): string {
    log.debug(`Returning line indented by ${this.indent}`);
    const indent = this.indent > 0 ? " ".repeat(this.indent) : "";
    return indent + this.outLineWords.join(" ");
  }

  /**
   * @returns true if there are no words in the buffer
   */
  public isEmpty(): boolean {
    return this.outLineWords.length === 0;
  }

  /**
   * Add a word to the buffer.
   *
   * @param word A word to output.
   */
  public push(word: string): void {
    this.outLineWords.push(word);
  }

  /**
   * Reset the buffer, removing all words and setting indent back to 0.
   */
  public reset(): void {
    this.outLineWords = [];
    this.indent = 0;
  }
}
