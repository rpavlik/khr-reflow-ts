// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import { REGEXES } from "./Regexes";

describe("endPara", () => {
  test("should match these strings", () => {
    expect("").toMatch(REGEXES.endPara);
    expect("  ").toMatch(REGEXES.endPara);
    expect("[block options]").toMatch(REGEXES.endPara);
    expect("[[anchor]]").toMatch(REGEXES.endPara);
    expect("// comment").toMatch(REGEXES.endPara);
    // page break
    expect("<<<<").toMatch(REGEXES.endPara);
    expect(":attribute-setting").toMatch(REGEXES.endPara);
    expect("macrodirective::terms").toMatch(REGEXES.endPara);
    expect("+").toMatch(REGEXES.endPara);
    expect("label::").toMatch(REGEXES.endPara);
  });
  test("should not match these", () => {
    expect("asdf").not.toMatch(REGEXES.endPara);
    expect("+5").not.toMatch(REGEXES.endPara);
    // expect('////').not.toMatch(Regexes.endPara);
  });
});

describe("endParaContinue", () => {
  test("should match these strings", () => {
    expect(".anything").toMatch(REGEXES.endParaContinue);
    expect(".Extension Name Formatting\n").toMatch(REGEXES.endParaContinue);
    expect("=== Section Titles").toMatch(REGEXES.endParaContinue);
    expect("image::path_to_image[attributes]").toMatch(REGEXES.endParaContinue);
    expect("image:path_to_image[attributes]").toMatch(REGEXES.endParaContinue);
  });
  test("should not match these", () => {

    expect("path_to_image[attributes]").not.toMatch(REGEXES.endParaContinue);
    expect("abc").not.toMatch(REGEXES.endParaContinue);
    expect("1.").not.toMatch(REGEXES.endParaContinue);
    expect("e.g.").not.toMatch(REGEXES.endParaContinue);
  });
});

describe("blockReflow", () => {
  test("should match these strings", () => {
    expect("--").toMatch(REGEXES.blockReflow);
    expect("****").toMatch(REGEXES.blockReflow);
    expect("====").toMatch(REGEXES.blockReflow);
    expect("____").toMatch(REGEXES.blockReflow);
  });
  test("should match these extended strings", () => {
    expect("*****").toMatch(REGEXES.blockReflow);
    expect("=====").toMatch(REGEXES.blockReflow);
    expect("_____").toMatch(REGEXES.blockReflow);
  });

  test("should not match these", () => {
    expect("---").not.toMatch(REGEXES.blockReflow);
    expect("----").not.toMatch(REGEXES.blockReflow);
    expect("-").not.toMatch(REGEXES.blockReflow);
    expect("***").not.toMatch(REGEXES.blockReflow);
    expect("===").not.toMatch(REGEXES.blockReflow);
    expect("___").not.toMatch(REGEXES.blockReflow);
  });
});

describe("blockPassthrough", () => {
  test("should match these strings", () => {
    expect("|===").toMatch(REGEXES.blockPassthrough); // (3 or more)  (table)
    expect("++++").toMatch(REGEXES.blockPassthrough); // (4 or more)  (passthrough block)
    expect("....").toMatch(REGEXES.blockPassthrough); // (4 or more)  (literal block)
    expect("////").toMatch(REGEXES.blockPassthrough); // (4 or more)  (comment block)
    expect("----").toMatch(REGEXES.blockPassthrough); // (4 or more)  (listing block)
    expect("```").toMatch(REGEXES.blockPassthrough); // (exactly 3)  (listing block)
  });
  test("should match these extended strings", () => {
    expect("|====").toMatch(REGEXES.blockPassthrough); // (3 or more)  (table)
    expect("+++++").toMatch(REGEXES.blockPassthrough); // (4 or more)  (passthrough block)
    expect(".....").toMatch(REGEXES.blockPassthrough); // (4 or more)  (literal block)
    expect("/////").toMatch(REGEXES.blockPassthrough); // (4 or more)  (comment block)
    expect("-----").toMatch(REGEXES.blockPassthrough); // (4 or more)  (listing block)
  });
  test("should not match these", () => {
    expect("|==").not.toMatch(REGEXES.blockPassthrough); // (3 or more)  (table)
    expect("+++").not.toMatch(REGEXES.blockPassthrough); // (4 or more)  (passthrough block)
    expect("...").not.toMatch(REGEXES.blockPassthrough); // (4 or more)  (literal block)
    expect("///").not.toMatch(REGEXES.blockPassthrough); // (4 or more)  (comment block)
    expect("---").not.toMatch(REGEXES.blockPassthrough); // (4 or more)  (listing block)
    expect("``").not.toMatch(REGEXES.blockPassthrough); //  (exactly 3)  (listing block)
    expect("````").not.toMatch(REGEXES.blockPassthrough);
  });
});

describe("endAbbrev", () => {
  test("should match these strings", () => {
    expect("e.g.").toMatch(REGEXES.endAbbrev);
    expect("i.e.").toMatch(REGEXES.endAbbrev);
    expect("c.f.").toMatch(REGEXES.endAbbrev);
  });
  test("should not match these", () => {
    expect("e.e.").not.toMatch(REGEXES.endAbbrev);
  });
});
