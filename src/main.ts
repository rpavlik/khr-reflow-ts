// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import ReflowOptions from "./ReflowOptions";
import ReflowState from "./ReflowState";
import { createReadStream } from "fs";
import { createInterface } from "readline";

export function reflowLines(lines: string[], options: ReflowOptions | null): string {
    let state = new ReflowState(options);
    state.processLines(lines);
    return state.getEmittedText();
}


export function reflowFile(filename: string, options: ReflowOptions | null): string {
    let state = new ReflowState(options);
    let input = createReadStream(filename);
    createInterface(input).on('line', line => {
        state.processLine(line);
    });
    state.endInput();
    return state.getEmittedText();
}
