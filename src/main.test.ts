// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: CC-BY-4.0

import fs from 'fs';
import path from 'path';
import { reflowLines, stringToLines } from "./main";

function readTestData(name: string): { input: string[]; expected: string; } {
    const pathStem = path.join(__dirname, '../test-data', name);
    const input = stringToLines(fs.readFileSync(`${pathStem}.input.adoc`, { encoding: 'utf-8' }));
    const expected = fs.readFileSync(`${pathStem}.expected.adoc`, { encoding: 'utf-8' });
    return { input: input, expected: expected };
}

function readNumberedTestData(name: string, inputNum: number): { input: string[]; expected: string; } {
    const pathStem = path.join(__dirname, '../test-data', name);
    const input = stringToLines(fs.readFileSync(`${pathStem}.input.${inputNum}.adoc`, { encoding: 'utf-8' }));
    const expected = fs.readFileSync(`${pathStem}.expected.adoc`, { encoding: 'utf-8' });
    return { input: input, expected: expected };
}

test('first do no harm', () => {
    let bareInput =
        `This is a first line.
`;
    let input = stringToLines(bareInput)
    expect(input).toHaveLength(1);
    expect(input[0]).toMatch(/\n$/m);
    expect(reflowLines(input, null)).toEqual(input.join(''));
});

test('first do no harm 2', () => {
    let bareInput =
        `This is a first line.
This is a second.
`;
    let input = stringToLines(bareInput);
    expect(reflowLines(input, null)).toEqual(bareInput);
});


test('normal paragraph', () => {
    let bareInput =
        `In each such use, the API major version number, minor version number, and patch version number are packed into a 64-bit integer, referred to as
basetype:XrVersion, as follows:
`;
    let input = stringToLines(bareInput);
    expect(reflowLines(input, null)).toEqual(String.raw`In each such use, the API major version number, minor version number, and
patch version number are packed into a 64-bit integer, referred to as
basetype:XrVersion, as follows:
`);
});
