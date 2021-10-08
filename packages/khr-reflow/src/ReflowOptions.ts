// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

/**
 * Configuration for the reflow engine.
 */
export default class ReflowOptions {
  /** margin to reflow text to. */
  margin = 76;

  /** true if justification should break to a new line after the end of a sentence. */
  breakPeriod = true;

  /** true if text should be reflowed, false to pass through unchanged. */
  reflow = true;

  /** Integer to start tagging un-numbered Valid Usage statements with, or null if no tagging should be done. */
  nextvu: number | null = null;

  /** Line number to start at */
  initialLineNumber = 1;
}
