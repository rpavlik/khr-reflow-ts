// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: CC-BY_4.0

import { reflowLines } from "./main";

function stringToInputLines(input: string) {
    return input.split('\n').map((line) => { return line + '\n'; });
}
test('first do no harm', () => {
    let bareInput =
        `This is a first line.
`;
    let input = stringToInputLines(bareInput)
    expect(reflowLines(input, null)).toEqual(bareInput);
});

test('first do no harm 2', () => {
    let bareInput =
        `This is a first line.
This is a second.
`;
    let input = stringToInputLines(bareInput);
    expect(reflowLines(input, null)).toEqual(bareInput);
});


test('normal paragraph', () => {
    let bareInput =
        `In each such use, the API major version number, minor version number, and patch version number are packed into a 64-bit integer, referred to as
basetype:XrVersion, as follows:
`;
    let input = stringToInputLines(bareInput);
    expect(reflowLines(input, null)).toEqual(String.raw`In each such use, the API major version number, minor version number, and
patch version number are packed into a 64-bit integer, referred to as
basetype:XrVersion, as follows:
`);
});
