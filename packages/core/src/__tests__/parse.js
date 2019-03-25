// @flow
import * as parser from "@babel/parser";
import containDeep from "jest-expect-contain-deep";
import { visitor, prettyPrint } from "../parse";
import traversal from "../traversal";
import { getTypes } from "../types";

const collectIds = (r, { path, type }) =>
  path.node.type === "Identifier"
    ? Object.assign(r, {
        [path.node.name]: prettyPrint(type)
      })
    : r;

const nextId = () => {
  let id = 0;
  return () => `${++id}`;
};

const { boolT, funcT, intT, varT, strT, objT, voidT } = getTypes(nextId());

it("should infer identity function type", () => {
  const code = `x => x`;
  const ast = parser.parse(code);
  const res = traversal(visitor, ast, nextId())(
    (curr, { path, type }) =>
      Object.assign(curr, {
        [path.node.type]: prettyPrint(type)
      }),
    {}
  );
  const x = varT();
  expect(res.ArrowFunctionExpression).toEqual(prettyPrint(funcT([x], x)));
});

it("should infer arg function type", () => {
  const code = `x => x(true)`;
  const ast = parser.parse(code);
  const res = traversal(visitor, ast, nextId())(
    (curr, { path, type }) =>
      Object.assign(curr, {
        [path.node.type]: prettyPrint(type)
      }),
    {}
  );
  const x = varT();
  expect(res.ArrowFunctionExpression).toEqual(
    prettyPrint(funcT([funcT([boolT()], x)], x))
  );
});

it.only("should infer identity call type", () => {
  const code = `(x => x)(1)`;
  const ast = parser.parse(code);
  const res = traversal(visitor, ast, nextId())(
    (curr, { path, type }) =>
      Object.assign(curr, {
        [path.node.type]: prettyPrint(type)
      }),
    {}
  );
  const x = varT();
  expect(res.CallExpression).toEqual(prettyPrint(intT()));
  expect(res.ArrowFunctionExpression).toEqual(prettyPrint(funcT([x], x)));
});

it("should infer multi arg function type", () => {
  const code = `(x, y) => y`;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const res = Object.keys(graph).reduce(
    (curr, k) =>
      Object.assign(curr, {
        [graph[k].node.type]: prettyPrint(graph[k].type)
      }),
    {}
  );
  const x = varT(),
    y = varT();
  expect(res.ArrowFunctionExpression).toEqual(prettyPrint(funcT([x, y], y)));
});

it("should infer assignment", () => {
  const code = `const f = x => x`;
  const ast = parser.parse(code);
  const ids = traversal(visitor, ast, nextId())(collectIds, {});
  const x = varT();
  expect(ids.f).toEqual(prettyPrint(funcT([x], x)));
});

it("should infer assignment then call expression", () => {
  const code = `
    const f = x => x;
    const i = f(1);
  `;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const ids = collectIds(graph);
  expect(ids.i).toEqual(prettyPrint(intT()));
});

it("should infer string type", () => {
  const code = `
    const greeting = "hi";
  `;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const ids = collectIds(graph);
  expect(ids.greeting).toEqual(prettyPrint(strT()));
});

it("should infer object type", () => {
  const code = `
    const person = {
      name: 'Jill',
      age: 41
    }
  `;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const ids = collectIds(graph);
  expect(ids.person).toEqual(
    prettyPrint(objT([["name", strT()], ["age", intT()]]))
  );
});

it("should model single-arity memoize function", () => {
  const code = `
    const memoize = fn => a => fn(a);
    const getOne = memoize(a => 1);
    const n = getOne(0);
  `;
  const ast = parser.parse(code);
  const graph = collector(ast);
  const ids = collectIds(graph);
  expect(ids.getOne).toEqual(prettyPrint(funcT([varT()], intT())));
  expect(ids.n).toEqual(prettyPrint(intT()));
});
