// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: CC-BY-4.0

import fs from 'fs';
import path from 'path';
import { reflowLines, stringToLines } from "./main";

function readExpectedFile(name: string): string {
    const fn = path.join(__dirname, '../test-data', `${name}.expected.adoc`);
    return fs.readFileSync(fn, { encoding: 'utf-8' });
}

function readInputData(name: string, inputNum?: number): string[] {
    const fn = path.join(__dirname, '../test-data',
        (inputNum === undefined) ?
            `${name}.input.adoc` :
            `${name}.input.${inputNum}.adoc`);
    return stringToLines(fs.readFileSync(fn, { encoding: 'utf-8' }));
}

class TestData {
    private stem_: string;
    private expected_: string;
    constructor(stem: string) {
        this.stem_ = stem;
        this.expected_ = readExpectedFile(this.stem_);
    }
    public get expected(): string {
        return this.expected_;
    }

    public inputData(inputNum?: number): string[] {
        return readInputData(this.stem_, inputNum);
    }
}

test('first do no harm', () => {
    let bareInput =
        `This is a first line.
`;
    let input = stringToLines(bareInput);
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

test('box do no harm', () => {
    let bareInput =
        String.raw`
.Extension Name Formatting
****
* The prefix "code:XR_" to identify this as an OpenXR extension
****
`;
    let input = stringToLines(bareInput);
    expect(reflowLines(input, null)).toEqual(bareInput);
});

describe('box with simpler hanging indent', () => {
    const data = new TestData("preserve-hanging-indent");
    test('can combine while preserving the right hanging indent', () => {
        expect(reflowLines(data.inputData(), null)).toEqual(data.expected);
    });
});

describe('box with simpler, but unusual hanging indent', () => {
    const data = new TestData("preserve-unusual-hanging-indent");
    test('can reflow while preserving the unusual hanging indent', () => {
        expect(reflowLines(data.inputData(), null)).toEqual(data.expected);
    });
});

describe('box with hanging indent', () => {
    const data = new TestData("hanging-indent");
    test('can be formatted correctly when partially flattened', () => {
        expect(reflowLines(data.inputData(1), null)).toEqual(data.expected);
    });
    test('can be formatted correctly when fully flattened', () => {
        expect(reflowLines(data.inputData(2), null)).toEqual(data.expected);
    });
});
