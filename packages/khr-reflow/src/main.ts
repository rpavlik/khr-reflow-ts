// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import ReflowOptions from "./ReflowOptions";
import ReflowState from "./ReflowState";
import { createWriteStream } from "fs";
import LineByLineReader from "line-by-line";

export { ReflowOptions, ReflowState };

/**
 * Split a string into an array of lines with trailing line ending
 * @param input Text string
 * @returns array of lines, each with their own trailing line ending
 */
export function stringToLines(input: string): string[] {
  const results = input.match(/(\n)|([^\n]+\n?)/gm);
  if (!results) {
    return [];
  } else {
    return Array.from(results);
  }
}

/**
 * Reflow an array of lines, return a reflowed string.
 *
 * @param lines array of lines, each with their own trailing line ending
 * @param options any non-default configuration
 * @returns reflowed text in a single string
 */
export function reflowLines(lines: string[], options?: ReflowOptions | null | undefined): string {
  const state = new ReflowState(options === null ? undefined : options);
  state.processLinesAndEndInput(lines);
  return state.getEmittedText();
}

/**
 * Reflow the contents of a file.
 *
 * @param filename Filename to process.
 * @param options any non-default configuration
 * @param cb Optional callback called with emitted text
 * @returns Reflowed text
 */
export function reflowFile(
  filename: string,
  options: ReflowOptions | null = null,
  cb: null | ((emitted: string) => void) = null
): string {
  const state = new ReflowState(options === null ? undefined : options);
  const reader = new LineByLineReader(filename, { encoding: "utf8" });
  reader.on("line", (line: string) => {
    state.processLine(line + "\n");
  });
  reader.on("end", () => {
    state.endInput();
    if (cb !== null) {
      cb(state.getEmittedText());
    }
  });
  return state.getEmittedText();
}

/**
 * Reflow the contents of a file to a file.
 *
 * @param filename Filename to process.
 * @param outFilename Filename to write.
 * @param options any non-default configuration
 */
export function reflowFileToFile(filename: string, outFilename: string, options: ReflowOptions | null): void {
  reflowFile(filename, options, (emitted) => {
    const stream = createWriteStream(outFilename, "utf-8");
    stream.write(emitted, () => {
      stream.end();
    });
  });
}
