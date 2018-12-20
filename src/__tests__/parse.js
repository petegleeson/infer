// @flow
import * as parser from "@babel/parser";
import { collector, resolver, getType, ERROR } from "../parse";

it("should error on binary expression", () => {
  const code = `'hello' + 1;`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const errors = resolver(graph);
  expect(errors).toEqual([ERROR]);
});

it("should validate binary expression", () => {
  const code = `n + 1;`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const errors = resolver(graph);
  expect(errors).toEqual([]);
});
