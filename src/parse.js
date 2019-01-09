// @flow
import traverse from "@babel/traverse";

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
  kind: Kind,
  node: Node
};

type Edge = {
  from: Vertex,
  to: Vertex,
  constraint: Constraint
};

type Graph = {
  vertices: Vertex[],
  edges: Edge[]
};

const findVertex = (graph: Graph, node) =>
  graph.vertices.find(vertex => vertex.node === node);

const addVertex = (graph: Graph, node) => {
  return {
    ...graph,
    vertices: [...graph.vertices, node]
  };
};

const addEdge = (graph, { from, to, constraint }) => {
  return {
    ...graph,
    edges: [...graph.edges, { from, to, constraint }]
  };
};

const createGraph = () => ({
  vertices: [],
  edges: []
});

const map = (graph, fn) => ({
  vertices: graph.vertices.map(fn),
  edges: graph.edges
});

const compose = (...fns) =>
  fns.reduce((g, f) => (...args) => f(g(...args)), x => x);

// const returnType = node => ({ kind: "Return", node });
// const openType = node => ({ kind: "Open", node });
// const intType = node => ({ kind: "Int", node });
// const funcType = node => ({ kind: "Func", node });
// const binaryExpressionType = node => ({
//   kind: "Expression",
//   node
// });

export const collector = ast => {
  let graph = createGraph();
  traverse(ast, {
    BinaryExpression: {
      exit(path) {
        const { left, right } = path.node;
        const me: Vertex = {
          node: path.node,
          kind: int()
        };
        path.data.type = me;
        graph = addVertex(graph, me);

        graph = addEdge(graph, {
          from: me,
          to: findVertex(graph, left),
          constraint: kind =>
            kind.type === "open" || kind.type === "int" ? int() : ERROR
        });

        graph = addEdge(graph, {
          from: me,
          to: findVertex(graph, right),
          constraint: kind =>
            kind.type === "open" || kind.type === "int" ? int() : ERROR
        });
      }
    },
    Identifier: {
      exit(path) {
        const me: Vertex = {
          node: path.node,
          kind: open()
        };
        path.data.type = me;

        graph = addVertex(graph, me);

        const binding = path.scope.bindings[me.node.name];
        if (binding && binding.identifier !== me.node) {
          graph = addEdge(graph, {
            from: me,
            to: findVertex(graph, binding.identifier),
            constraint: kind => kind
          });
        }
      }
    },
    FunctionDeclaration: {
      enter(path) {
        const { id, params } = path.node;
        const me: Vertex = {
          node: path.node,
          kind: func(params.map(open))
        };

        graph = addVertex(graph, me);
      },
      exit(path) {
        if (path.node.id) {
          const me = findVertex(graph, path.node);
          const id = findVertex(graph, path.node.id);
          graph = addEdge(graph, {
            from: me,
            to: id,
            constraint: kind => {
              console.log("identifer constraining kind", kind);
              return kind === "open" ? me.kind : ERROR;
            }
          });
        }
      }
    },
    NumericLiteral: {
      exit(path) {
        const me: Vertex = {
          node: path.node,
          kind: int()
        };
        path.data.type = me;

        graph = addVertex(graph, me);
      }
    },
    ReturnStatement: {
      exit(path) {
        const me: Vertex = {
          node: path.node,
          kind: open()
        };
        path.data.type = me;

        graph = addVertex(graph, me);

        const parentFunction = findVertex(graph, path.getFunctionParent().node);
        graph = addEdge(graph, {
          from: me,
          to: parentFunction,
          constraint: kind => kind
        });

        const arg = findVertex(graph, path.node.argument);
        graph = addEdge(graph, {
          from: arg,
          to: me,
          constraint: kind => kind
        });
      }
    },
    StringLiteral: {
      exit(path) {
        const type: Vertex = {
          node: path.node,
          kind: string()
        };
        graph.addVertex(type);
        path.data.type = type;
      }
    }
  });
  return graph;
};

export const resolver = graph => {
  // const constraints = vertex => {
  //   return vertex.value.constraints.reduce((a, c) => {
  //     console.log("node", vertex.value.node, "\nconstraint", c.fn);
  //     return [...constraints(graph.findNode(c.node)), c.fn, ...a];
  //   }, []);
  // };

  // const n = graph.vertices.find(
  //   v => v.value.node.type === "Identifier" && v.value.node.name === "add"
  // );
  // console.log("inferring", n.value);

  const constrain = vertex => {
    // TODO: extend this to multiple incoming constraints
    const edge = graph.edges.find(({ to }) => to === vertex);
    console.log("vertex", vertex);
    console.log("edge", edge);
    if (!edge) {
      return vertex;
    }
    const { from, to, constraint } = edge;
    return {
      ...vertex,
      kind: constraint(constrain(findVertex(graph, from)))
    };
  };

  return map(graph, constrain);
};
