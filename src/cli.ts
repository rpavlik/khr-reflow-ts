// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import { reflowFile, reflowFileToFile } from "./main";
import parseArgs from "minimist";
import ReflowOptions from "./ReflowOptions";

var pkg = require("../package.json");

let args = parseArgs(process.argv.slice(2), {
    alias: {
        help: 'h',
        overwrite: 'o'
    },
    default: new ReflowOptions(),
    // {
    //     breakPeriod: true,
    //     reflow: true,
    //     margin: 76
    // }
});

if (args._.length == 0 || args._.length > 2) {
    console.log('Please pass exactly one or two positional arguments.');
    args.help = true;
}
if (args.help) {
    let defaultOptions = new ReflowOptions();
    console.log(`
${pkg.name} ${pkg.version}
${pkg.description}

${process.argv0} <INPUT_FILE> [<OUTPUT_FILE>] [options]

-h, --help          get help
--no-break-period   do not break to a new line after the end of a sentence
--no-reflow         do not reflow
--nextvu=VAL        assign VUIDs starting at VAL
--margin=VAL        reflow at a width of VAL (default ${defaultOptions.margin})
-o, --overwrite     write output to the same file as the input
                    (if not passed and no output file name specified, will output to stdout)
`);
    process.exit(1);
}
let input = args._[0];
let output: string | null = null;
if (args._.length == 2) {
    output = args._[1];
} else if (args.overwrite) {
    output = input;
}
let options = new ReflowOptions();

options.breakPeriod = args.breakPeriod;
options.margin = args.margin;
options.reflow = args.reflow;
console.log(options);


if (output === null) {
    console.log(`Reflowing ${input} to stdout`);
    let result = reflowFile(input, options);
    process.stdout.write(result);
} else {
    console.log(`Reflowing ${input} to ${output}`);
    reflowFileToFile(input, output, options);
}
