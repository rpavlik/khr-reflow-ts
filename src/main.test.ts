// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import { reflowLines } from "./main";

test('first do no harm', () => {
    let bareInput =
        `This is a first line.
`;
    let input = bareInput.split('\n').map((line) => { return line + '\n'; });
    expect(reflowLines(input, null)).toEqual(bareInput);
});

test('first do no harm 2', () => {
    let bareInput =
        `This is a first line.
This is a second.
`;
    let input = bareInput.split('\n').map((line) => { return line + '\n'; });
    expect(reflowLines(input, null)).toEqual(bareInput);
});
