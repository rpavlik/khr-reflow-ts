// Copyright (c) 2016-2021, The Khronos Group Inc.
// Copyright 2021 Collabora, Ltd
//
// SPDX-License-Identifier: Apache-2.0

import { Regexes } from "./Regexes"


describe('endPara', () => {
    test('should match these strings', () => {
        expect('').toMatch(Regexes.endPara);
        expect('  ').toMatch(Regexes.endPara);
        expect('[block options]').toMatch(Regexes.endPara);
        expect('[[anchor]]').toMatch(Regexes.endPara);
        expect('// comment').toMatch(Regexes.endPara);
        // page break
        expect('<<<<').toMatch(Regexes.endPara);
        expect(':attribute-setting').toMatch(Regexes.endPara);
        expect('macrodirective::terms').toMatch(Regexes.endPara);
        expect('+').toMatch(Regexes.endPara);
        expect('label::').toMatch(Regexes.endPara);
    });
    test('should not match these', () => {
        expect('asdf').not.toMatch(Regexes.endPara);
        expect('+5').not.toMatch(Regexes.endPara);
        // expect('////').not.toMatch(Regexes.endPara);
    });
})

describe('endParaContinue', () => {
    test('should match these strings', () => {
        expect('.anything').toMatch(Regexes.endParaContinue);
        expect('=== Section Titles').toMatch(Regexes.endParaContinue);
        expect('image::path_to_image[attributes]').toMatch(Regexes.endParaContinue);
        expect('image:path_to_image[attributes]').toMatch(Regexes.endParaContinue);
    });
    test('should not match these', () => {
    });
})

describe('blockReflow', () => {
    test('should match these strings', () => {
        expect('--').toMatch(Regexes.blockReflow);
        expect('****').toMatch(Regexes.blockReflow);
        expect('====').toMatch(Regexes.blockReflow);
        expect('____').toMatch(Regexes.blockReflow);
    });
    test('should match these extended strings', () => {
        expect('*****').toMatch(Regexes.blockReflow);
        expect('=====').toMatch(Regexes.blockReflow);
        expect('_____').toMatch(Regexes.blockReflow);
    });

    test('should not match these', () => {
        expect('---').not.toMatch(Regexes.blockReflow);
        expect('----').not.toMatch(Regexes.blockReflow);
        expect('-').not.toMatch(Regexes.blockReflow);
        expect('***').not.toMatch(Regexes.blockReflow);
        expect('===').not.toMatch(Regexes.blockReflow);
        expect('___').not.toMatch(Regexes.blockReflow);
    });
})

describe('blockPassthrough', () => {
    test('should match these strings', () => {
        expect('|===').toMatch(Regexes.blockPassthrough); // (3 or more)  (table)
        expect('++++').toMatch(Regexes.blockPassthrough); // (4 or more)  (passthrough block)
        expect('....').toMatch(Regexes.blockPassthrough); // (4 or more)  (literal block)
        expect("////").toMatch(Regexes.blockPassthrough); // (4 or more)  (comment block)
        expect('----').toMatch(Regexes.blockPassthrough); // (4 or more)  (listing block)
        expect('```').toMatch(Regexes.blockPassthrough); // (exactly 3)  (listing block)
    });
    test('should match these extended strings', () => {
        expect('|====').toMatch(Regexes.blockPassthrough); // (3 or more)  (table)
        expect('+++++').toMatch(Regexes.blockPassthrough); // (4 or more)  (passthrough block)
        expect('.....').toMatch(Regexes.blockPassthrough); // (4 or more)  (literal block)
        expect("/////").toMatch(Regexes.blockPassthrough); // (4 or more)  (comment block)
        expect('-----').toMatch(Regexes.blockPassthrough); // (4 or more)  (listing block)
    });
    test('should not match these', () => {
        expect('|==').not.toMatch(Regexes.blockPassthrough); // (3 or more)  (table)
        expect('+++').not.toMatch(Regexes.blockPassthrough); // (4 or more)  (passthrough block)
        expect('...').not.toMatch(Regexes.blockPassthrough); // (4 or more)  (literal block)
        expect("///").not.toMatch(Regexes.blockPassthrough); // (4 or more)  (comment block)
        expect('---').not.toMatch(Regexes.blockPassthrough); // (4 or more)  (listing block)
        expect('``').not.toMatch(Regexes.blockPassthrough); //  (exactly 3)  (listing block)
        expect('````').not.toMatch(Regexes.blockPassthrough);
    });

});

describe('endAbbrev', () => {
    test('should match these strings', () => {
        expect('e.g.').toMatch(Regexes.endAbbrev);
        expect('i.e.').toMatch(Regexes.endAbbrev);
        expect('c.f.').toMatch(Regexes.endAbbrev);
    });
    test('should not match these', () => {
        expect('e.e.').not.toMatch(Regexes.endAbbrev);
    });

});
