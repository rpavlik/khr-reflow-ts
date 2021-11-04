// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import ReflowState from "./ReflowState";

const SAMPLE_LINES = ["This is the first line.\n", "This is the second line.\n", "\n"];

describe("reflow state between-paragraphs property", () => {
  test("should start as true", () => {
    const state = new ReflowState();
    expect(state.isBetweenParagraphs()).toBe(true);
  });
  test("should be false after line(s) containing paragraph text", () => {
    const state = new ReflowState();
    state.processLine(SAMPLE_LINES[0]);
    expect(state.isBetweenParagraphs()).toBe(false);
    state.processLine(SAMPLE_LINES[1]);
    expect(state.isBetweenParagraphs()).toBe(false);
  });
  test("should be true again after a blank line ends a paragraph", () => {
    const state = new ReflowState();
    state.processLine(SAMPLE_LINES[0]);
    state.processLine(SAMPLE_LINES[1]);
    state.processLine(SAMPLE_LINES[2]);
    expect(state.isBetweenParagraphs()).toBe(true);
    expect(state.getEmittedLines()).toHaveLength(3);
    expect(state.getEmittedLines()[0]).toEqual(SAMPLE_LINES[0]);
    expect(state.getEmittedLines()[1]).toEqual(SAMPLE_LINES[1]);
    expect(state.getEmittedLines()[2]).toEqual(SAMPLE_LINES[2]);
  });
});
