// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import { reflowFile, reflowFileToFile } from "./main";
import parseArgs from "minimist";
import ReflowOptions from "./ReflowOptions";

var pkg = require("../package.json");

import yargs, { boolean } from 'yargs';
import { hideBin } from 'yargs/helpers';

let defaultOptions = new ReflowOptions();
yargs(hideBin(process.argv))
    .version()
    .usage('Usage: $0 <input_file> [<output_file>] [options]')
    .options({
        'no-break-period': { boolean: true, desc: 'Do not break to a new line after the end of a sentence' },
        'no-reflow': { boolean: true, desc: 'Do not reflow to width' },
        'margin': { number: true, default: defaultOptions.margin, desc: 'Maximum width for wrapping' },
        'overwrite': { boolean: true, desc: 'Overwrite the input file with the processed output' },
    })
    .demandCommand(1, 2, "Must provide at least an input filename", "May not provide more than one input and one output filename")
    .help()
    .command('$0 <input> [<output>]', 'Reflow AsciiDoctor files as Khronos does', (yargs) => {
        yargs
            .positional('input', { demandOption: true, type: 'string', desc: 'Input filename' })
            .positional('output', { demandOption: false, type: 'string', desc: 'Output filename' })
    }, (args) => {

        // let args = parseArgs(process.argv.slice(2), {
        //         alias: {
        //             help: 'h',
        //             overwrite: 'o'
        //         },
        //         default: new ReflowOptions(),
        //         // {
        //         //     breakPeriod: true,
        //         //     reflow: true,
        //         //     margin: 76
        //         // }
        //     });

        // if (args._.length == 0 || args._.length > 2) {
        //     console.log('Please pass exactly one or two positional arguments.');
        //     args.help = true;
        // }
        // if (args.help) {
        //     console.log(`
        // ${pkg.name} ${pkg.version}
        // ${pkg.description}

        // ${process.argv0} <INPUT_FILE> [<OUTPUT_FILE>] [options]

        // -h, --help          get help
        // --no-break-period   do not break to a new line after the end of a sentence
        // --no-reflow         do not reflow
        // --nextvu=VAL        assign VUIDs starting at VAL
        // --margin=VAL        reflow at a width of VAL (default ${defaultOptions.margin})
        // -o, --overwrite     write output to the same file as the input
        //                     (if not passed and no output file name specified, will output to stdout)
        // `);
        //     process.exit(1);
        // }
        let input = args.input as string;
        let output: string | null = null;
        if (args.output != null) {
            output = args.output as string;
        } else if (args.overwrite) {
            output = input;
        }
        let options = new ReflowOptions();

        options.breakPeriod = !args["no-break-period"];
        options.margin = args.margin;
        options.reflow = !args["no-reflow"];
        console.log(options);


        if (output === null) {
            console.log(`Reflowing ${input} to stdout`);
            let result = reflowFile(input, options);
            process.stdout.write(result);
        } else {
            console.log(`Reflowing ${input} to ${output}`);
            reflowFileToFile(input, output, options);
        }

    });
