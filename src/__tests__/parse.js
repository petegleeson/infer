// @flow
import * as parser from "@babel/parser";
import { collector, resolver, getType } from "../parse";

it("should infer number", () => {
  const code = `function add(n) {
    return n + 1;
  };`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const add = graph.nodes.find(node => node.value.kind === "Func");
  // const errors = resolver(graph);
  expect(getType(graph, add)).toBe("(Int) => Int");
});

it("should leave identity function open", () => {
  const code = `function identity(n) {
    return n;
  };`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const add = graph.nodes.find(node => node.value.kind === "Func");
  // const errors = resolver(graph);
  expect(getType(graph, add)).toBe("(Open) => Open");
});
