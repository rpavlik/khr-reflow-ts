// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import REFLOW_REGEXES from "./Regexes";

describe("endPara", () => {
  test("should match these strings", () => {
    expect("").toMatch(REFLOW_REGEXES.endPara);
    expect("  ").toMatch(REFLOW_REGEXES.endPara);
    expect("[block options]").toMatch(REFLOW_REGEXES.endPara);
    expect("[[anchor]]").toMatch(REFLOW_REGEXES.endPara);
    expect("// comment").toMatch(REFLOW_REGEXES.endPara);
    // page break
    expect("<<<<").toMatch(REFLOW_REGEXES.endPara);
    expect(":attribute-setting").toMatch(REFLOW_REGEXES.endPara);
    expect("macrodirective::terms").toMatch(REFLOW_REGEXES.endPara);
    expect("+").toMatch(REFLOW_REGEXES.endPara);
    expect("label::").toMatch(REFLOW_REGEXES.endPara);
  });
  test("should not match these", () => {
    expect("asdf").not.toMatch(REFLOW_REGEXES.endPara);
    expect("+5").not.toMatch(REFLOW_REGEXES.endPara);
    // expect('////').not.toMatch(Regexes.endPara);
  });
});

describe("endParaContinue", () => {
  test("should match these strings", () => {
    expect(".anything").toMatch(REFLOW_REGEXES.endParaContinue);
    expect(".Extension Name Formatting\n").toMatch(REFLOW_REGEXES.endParaContinue);
    expect("=== Section Titles").toMatch(REFLOW_REGEXES.endParaContinue);
    expect("image::path_to_image[attributes]").toMatch(REFLOW_REGEXES.endParaContinue);
    expect("image:path_to_image[attributes]").toMatch(REFLOW_REGEXES.endParaContinue);
  });
  test("should not match these", () => {
    expect("path_to_image[attributes]").not.toMatch(REFLOW_REGEXES.endParaContinue);
    expect("abc").not.toMatch(REFLOW_REGEXES.endParaContinue);
    expect("1.").not.toMatch(REFLOW_REGEXES.endParaContinue);
    expect("e.g.").not.toMatch(REFLOW_REGEXES.endParaContinue);
  });
});

describe("blockReflow", () => {
  test("should match these strings", () => {
    expect("--").toMatch(REFLOW_REGEXES.blockReflow);
    expect("****").toMatch(REFLOW_REGEXES.blockReflow);
    expect("====").toMatch(REFLOW_REGEXES.blockReflow);
    expect("____").toMatch(REFLOW_REGEXES.blockReflow);
  });
  test("should match these extended strings", () => {
    expect("*****").toMatch(REFLOW_REGEXES.blockReflow);
    expect("=====").toMatch(REFLOW_REGEXES.blockReflow);
    expect("_____").toMatch(REFLOW_REGEXES.blockReflow);
  });

  test("should not match these", () => {
    expect("---").not.toMatch(REFLOW_REGEXES.blockReflow);
    expect("----").not.toMatch(REFLOW_REGEXES.blockReflow);
    expect("-").not.toMatch(REFLOW_REGEXES.blockReflow);
    expect("***").not.toMatch(REFLOW_REGEXES.blockReflow);
    expect("===").not.toMatch(REFLOW_REGEXES.blockReflow);
    expect("___").not.toMatch(REFLOW_REGEXES.blockReflow);
  });
});

describe("blockPassthrough", () => {
  test("should match these strings", () => {
    expect("|===").toMatch(REFLOW_REGEXES.blockPassthrough); // (3 or more)  (table)
    expect("++++").toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (passthrough block)
    expect("....").toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (literal block)
    expect("////").toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (comment block)
    expect("----").toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (listing block)
    expect("```").toMatch(REFLOW_REGEXES.blockPassthrough); // (exactly 3)  (listing block)
  });
  test("should match these extended strings", () => {
    expect("|====").toMatch(REFLOW_REGEXES.blockPassthrough); // (3 or more)  (table)
    expect("+++++").toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (passthrough block)
    expect(".....").toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (literal block)
    expect("/////").toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (comment block)
    expect("-----").toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (listing block)
  });
  test("should not match these", () => {
    expect("|==").not.toMatch(REFLOW_REGEXES.blockPassthrough); // (3 or more)  (table)
    expect("+++").not.toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (passthrough block)
    expect("...").not.toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (literal block)
    expect("///").not.toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (comment block)
    expect("---").not.toMatch(REFLOW_REGEXES.blockPassthrough); // (4 or more)  (listing block)
    expect("``").not.toMatch(REFLOW_REGEXES.blockPassthrough); //  (exactly 3)  (listing block)
    expect("````").not.toMatch(REFLOW_REGEXES.blockPassthrough);
  });
});

describe("endAbbrev", () => {
  test("should match these strings", () => {
    expect("e.g.").toMatch(REFLOW_REGEXES.endAbbrev);
    expect("i.e.").toMatch(REFLOW_REGEXES.endAbbrev);
    expect("c.f.").toMatch(REFLOW_REGEXES.endAbbrev);
  });
  test("should not match these", () => {
    expect("e.e.").not.toMatch(REFLOW_REGEXES.endAbbrev);
  });
});
