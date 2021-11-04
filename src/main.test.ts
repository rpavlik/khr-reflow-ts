// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: CC-BY-4.0

import fs from "fs";
import path from "path";
import { reflowLines, stringToLines } from "./main";

function readExpectedFile(name: string): string {
  const fn = path.join(__dirname, "../test-data", `${name}.expected.adoc`);
  return fs.readFileSync(fn, { encoding: "utf-8" });
}

function readInputData(name: string, inputNum?: number): string[] {
  const fn = path.join(
    __dirname,
    "../test-data",
    inputNum === undefined ? `${name}.input.adoc` : `${name}.input.${inputNum}.adoc`
  );
  return stringToLines(fs.readFileSync(fn, { encoding: "utf-8" }));
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

test("first do no harm", () => {
  const bareInput = `This is a first line.
`;
  const input = stringToLines(bareInput);
  expect(input).toHaveLength(1);
  expect(input[0]).toMatch(/\n$/m);
  expect(reflowLines(input, null)).toEqual(input.join(""));
});

test("first do no harm 2", () => {
  const bareInput = `This is a first line.
This is a second.
`;
  const input = stringToLines(bareInput);
  expect(reflowLines(input, null)).toEqual(bareInput);
});

test("normal paragraph", () => {
  const bareInput = `In each such use, the API major version number, minor version number, and patch version number are packed into a 64-bit integer, referred to as
basetype:XrVersion, as follows:
`;
  const input = stringToLines(bareInput);
  expect(reflowLines(input, null))
    .toEqual(String.raw`In each such use, the API major version number, minor version number, and
patch version number are packed into a 64-bit integer, referred to as
basetype:XrVersion, as follows:
`);
});

test("box do no harm", () => {
  const bareInput = String.raw`
.Extension Name Formatting
****
* The prefix "code:XR_" to identify this as an OpenXR extension
****
`;
  const input = stringToLines(bareInput);
  expect(reflowLines(input, null)).toEqual(bareInput);
});

describe("box with simpler hanging indent", () => {
  const data = new TestData("preserve-hanging-indent");
  test("can combine while preserving the right hanging indent", () => {
    expect(reflowLines(data.inputData(), null)).toEqual(data.expected);
  });
});

describe("box with simpler, but unusual hanging indent", () => {
  const data = new TestData("preserve-unusual-hanging-indent");
  test("can reflow while preserving the unusual hanging indent", () => {
    expect(reflowLines(data.inputData(), null)).toEqual(data.expected);
  });
});

describe("box with hanging indent", () => {
  const data = new TestData("hanging-indent");
  test("can be formatted correctly when partially flattened", () => {
    expect(reflowLines(data.inputData(1), null)).toEqual(data.expected);
  });
  test("can be formatted correctly when fully flattened", () => {
    expect(reflowLines(data.inputData(2), null)).toEqual(data.expected);
  });
});

describe("edge case 1 with hanging indent", () => {
  // we got this wrong compared with the Python: failed to join lines
  const data = new TestData("edge-case-1");
  test("can be formatted correctly and match the Python results", () => {
    expect(reflowLines(data.inputData(), null)).toEqual(data.expected);
  });
});

describe("edge case 2 with hanging indent", () => {
  // we got this wrong compared with the Python: failed to break lines
  const data = new TestData("edge-case-2");
  test("can be formatted correctly and match the Python results", () => {
    expect(reflowLines(data.inputData(), null)).toEqual(data.expected);
  });
});
