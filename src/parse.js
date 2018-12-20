// @flow
import traverse from "@babel/traverse";
import Graph from "./graph";

type Kind = "open" | "int" | "string";

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
          kind: "int",
          constraints: [
            {
              node: graph.findNode(left),
              fn: type => (type === "open" || type === "int" ? "int" : ERROR)
            },
            {
              node: graph.findNode(right),
              fn: type => (type === "open" || type === "int" ? "int" : ERROR)
            }
          ]
        };
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
          kind: "open",
          constraints: []
        };
        graph.addVertex(type);
        path.data.type = type;

        const binding = path.scope.bindings[type.node.name];
        if (binding && binding.identifier !== type.node) {
          graph.addLine(type.node, binding.identifier);
        }
      }
    },
    NumericLiteral: {
      exit(path) {
        const type: Vertex = {
          node: path.node,
          kind: "int",
          constraints: []
        };
        graph.addVertex(type);
        path.data.type = type;
      }
    },
    StringLiteral: {
      exit(path) {
        const type: Vertex = {
          node: path.node,
          kind: "string",
          constraints: []
        };
        graph.addVertex(type);
        path.data.type = type;
      }
    }
  });
  return graph;
};

// follow all constraints and return the errors
export const resolver = graph => {
  const follow = vertex => {
    if (vertex.value.constraints.length === 0) {
      return vertex.value.kind;
    }

    const fns = vertex.value.constraints.reduce(
      (a, c) => [...a, () => c.fn(follow(c.node))],
      []
    );
    return fns.map(fn => fn());
  };

  return graph.vertices
    .filter(({ value }) => value.constraints.length > 0)
    .reduce((a, c) => [...a, ...follow(c)], [])
    .filter(type => type === ERROR);
};

export const getType = (graph, entry) => {
  switch (entry.value.kind) {
    case "Func": {
      const ret = graph.nodes.find(
        n => n.value.kind === "Return" && n.lines.includes(entry)
      );
      return `(${entry.value.node.params
        .map(param => getType(graph, graph.findNode(param)))
        .join(", ")}) => ${ret ? getType(graph, ret) : "void"}`;
    }
    case "Return": {
      return getType(graph, graph.findNode(entry.value.node.argument));
    }
    case "Expression": {
      return "Int";
    }
    case "Open": {
      const upper = graph.nodes.find(n => n.lines.includes(entry));

      return upper ? getType(graph, upper) : "Open";
    }
    case "Int": {
      return "Int";
    }
    default:
      return "";
  }
};
