// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import ReflowOptions from "./ReflowOptions";
import ReflowState from "./ReflowState";

export function reflowLines(lines: string[], options: ReflowOptions | null): string {
    let state = new ReflowState(options);
    state.processLines(lines);
    return state.getEmittedText();
}

