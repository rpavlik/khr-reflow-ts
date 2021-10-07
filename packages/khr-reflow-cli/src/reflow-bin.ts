#!/usr/bin/env -S node -r "ts-node/register"
// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import { reflowFile, ReflowOptions, reflowFileToFile } from "@ryan.pavlik/khr-reflow";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const defaultOptions = new ReflowOptions();
const args = yargs(hideBin(process.argv))
  .options({
    input: { string: true, alias: "i", normalize: true, nargs: 1, demandOption: true, desc: "Input filename" },
    output: { string: true, alias: "O", normalize: true, nargs: 1, desc: "Output filename", conflicts: "overwrite" },
    "no-break-period": { boolean: true, desc: "Do not break to a new line after the end of a sentence" },
    "no-reflow": { boolean: true, desc: "Do not reflow to width" },
    margin: { number: true, default: defaultOptions.margin, desc: "Maximum width for wrapping" },
    overwrite: { boolean: true, alias: "o", desc: "Overwrite the input file with the processed output" },
  })
  .version()
  .usage("Usage: $0 <input_file> [<output_file>] [options]")
  .help().argv;

console.log(args);
const input: string = args.input;

let output: string | null = null;
if (args.output) {
  output = args.output;
} else if (args.overwrite) {
  output = input;
}
const options = new ReflowOptions();

options.breakPeriod = !args["no-break-period"];
options.margin = args.margin;
options.reflow = !args["no-reflow"];
console.log(options);

if (output === null) {
  console.log(`Reflowing ${input} to stdout`);
  const result = reflowFile(input, options);
  process.stdout.write(result);
} else {
  console.log(`Reflowing ${input} to ${output}`);
  reflowFileToFile(input, output, options);
}
