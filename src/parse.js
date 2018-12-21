// @flow
import traverse from "@babel/traverse";
import Graph, { map } from "./graph";

type OpenKind = { type: "open" };
export const open = (): OpenKind => ({ type: "open" });

type IntKind = { type: "int" };
export const int = (): IntKind => ({ type: "int" });

type StringKind = { type: "string" };
export const string = (): StringKind => ({ type: "string" });

type FuncKind = { type: "func", params: Kind[], returns: Kind };
export const func = (
  params: Kind[] = [],
  returns: Kind = open()
): FuncKind => ({
  type: "func",
  params,
  returns
});

type Kind = OpenKind | IntKind | StringKind | FuncKind;

export const ERROR = Symbol("CONSTRAINT_ERROR");
type ConstraintError = typeof ERROR;
type Constraint = Kind => Kind | ConstraintError;

type Node = Object;

type Vertex = {
  constraints: { node: Node, fn: Constraint }[],
  kind: Kind,
  node: Node
};

// const returnType = node => ({ kind: "Return", node });
// const openType = node => ({ kind: "Open", node });
// const intType = node => ({ kind: "Int", node });
// const funcType = node => ({ kind: "Func", node });
// const binaryExpressionType = node => ({
//   kind: "Expression",
//   node
// });

export const collector = ast => {
  const graph = new Graph();
  traverse(ast, {
    BinaryExpression: {
      exit(path) {
        const { left, right } = path.node;
        const type: Vertex = {
          node: path.node,
          kind: int(),
          constraints: []
        };

        graph.findNode(left).value.constraints.push({
          node: path.node,
          fn: kind =>
            kind.type === "open" || kind.type === "int" ? int() : ERROR
        });
        graph.findNode(right).value.constraints.push({
          node: path.node,
          fn: kind =>
            kind.type === "open" || kind.type === "int" ? int() : ERROR
        });
        graph.addVertex(type);

        graph.addLine(type.node, type.node.left);
        graph.addLine(type.node, type.node.right);
        path.data.type = type;
      }
    },
    Identifier: {
      exit(path) {
        const type: Vertex = {
          node: path.node,
          kind: open(),
          constraints: []
        };
        graph.addVertex(type);
        path.data.type = type;

        const binding = path.scope.bindings[type.node.name];
        if (binding && binding.identifier !== type.node) {
          const node = graph.findNode(binding.identifier);
          node.value.constraints.push({
            node: path.node,
            fn: kind => (kind.type === "open" ? type.kind : ERROR)
          });
          graph.addLine(type.node, binding.identifier);
        }
      }
    },
    FunctionDeclaration: {
      enter(path) {
        const { id, params } = path.node;
        // const idV: Vertex = {
        //   node: id,
        //   kind: open(),
        //   constraints: []
        // };
        // const paramsV = params.map(
        //   (p): Vertex => ({
        //     node: p,
        //     kind: open(),
        //     constraints: []
        //   })
        // );
        const functionV: Vertex = {
          node: path.node,
          kind: func(params.map(open)),
          constraints: []
        };
        graph.addVertex(functionV);
        // [functionV, idV, ...paramsV].forEach(v => graph.addVertex(v));
      }
    },
    NumericLiteral: {
      exit(path) {
        const type: Vertex = {
          node: path.node,
          kind: int(),
          constraints: []
        };
        graph.addVertex(type);
        path.data.type = type;
      }
    },
    ReturnStatement: {
      exit(path) {
        const parentFunction = graph.findNode(path.getFunctionParent().node);
        const arg = graph.findNode(path.node.argument);
        parentFunction.value.constraints.push({
          node: path.node,
          fn: ({ type, params, returns }) =>
            returns.type === "open" ? func(params, arg.value.kind) : ERROR
        });
      }
    },
    StringLiteral: {
      exit(path) {
        const type: Vertex = {
          node: path.node,
          kind: string(),
          constraints: []
        };
        graph.addVertex(type);
        path.data.type = type;
      }
    }
  });
  return graph;
};

export const resolver = graph => {
  const resolve = vertex => {
    return vertex.value.constraints.reduce((a, c) => {
      const n = graph.findNode(c.node).value;

      if (c.node.type === "Identifier") {
        console.log(n.constraints[0].fn(n.kind));
      }
      return c.fn(a);
    }, vertex.value.kind);
  };
  return map(graph, v => ({
    ...v,
    value: {
      ...v.value,
      kind: v.value.constraints.reduce((a, c) => {
        if (c.node.type === "Identifier") {
          const n = graph.findNode(c.node).value;
          console.log(n.constraints[0].fn(n.kind));
        }
        return c.fn(a);
      }, v.value.kind)
    }
  }));
};
