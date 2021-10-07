// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import ReflowOptions from "./ReflowOptions";
import ReflowState from "./ReflowState";
import { createWriteStream } from "fs";
import LineByLineReader from "line-by-line";

export { ReflowOptions, ReflowState };

export function stringToLines(input: string): string[] {
  const results = input.match(/(\n)|([^\n]+\n?)/gm);
  if (!results) {
    return [];
  } else {
    return Array.from(results);
  }
}

export function reflowLines(lines: string[], options?: ReflowOptions | null | undefined): string {
  const state = new ReflowState(options === null ? undefined : options);
  state.processLines(lines);
  return state.getEmittedText();
}

export function reflowFile(
  filename: string,
  options: ReflowOptions | null = null,
  cb: null | ((emitted: string) => void) = null
): string {
  const state = new ReflowState(options === null ? undefined : options);
  const reader = new LineByLineReader(filename, { encoding: "utf8" });
  // let input = createReadStream(filename, {encoding: 'utf-8'});
  // let reader = readline.createInterface({input: input});
  reader.on("line", (line: string) => {
    state.processLine(line + "\n");
  });
  reader.on("end", () => {
    state.endInput();
    if (cb !== null) {
      cb(state.getEmittedText());
    }
  });
  // readInterface.question
  // // reader.
  // state.endInput();
  // input.close();
  return state.getEmittedText();
}

export function reflowFileToFile(filename: string, outFilename: string, options: ReflowOptions | null): void {
  reflowFile(filename, options, (emitted) => {
    const stream = createWriteStream(outFilename, "utf-8");
    stream.write(emitted, () => {
      stream.end();
    });
  });
}
