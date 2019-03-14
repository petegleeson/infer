// @flow
import traverse from "@babel/traverse";

type OpenKind = { type: "open" };
export const open = (): OpenKind => ({ type: "open" });
const isOpen = (k: Kind) =>
  k.type === "open" || (k.result && k.result.type === "open");

type IntKind = { type: "int" };
export const int = (): IntKind => ({ type: "int" });
const isInt = (k: Kind) => k.type === "int";

type StringKind = { type: "string" };
export const string = (): StringKind => ({ type: "string" });
const isString = (k: Kind) => k.type === "string";

type FuncKind = { type: "func", params: Kind[], returns: Kind };
export const func = (
  params: Kind[] = [],
  returns: Kind = open()
): FuncKind => ({
  type: "func",
  params,
  returns
});
const isFunc = (k: Kind) => k.type === "func";

type BinOpKind = { type: "binOp", result: Kind };
export const binOp = (result: Kind = open()): BinOpKind => ({
  type: "binOp",
  result
});
const isBinOp = (k: Kind) => k.type === "binOp";

type RetKind = { type: "ret", result: Kind };
export const ret = (result: Kind = open()): RetKind => ({
  type: "ret",
  result
});
const isRet = (k: Kind) => k.type === "ret";

type Kind = OpenKind | IntKind | StringKind | FuncKind | BinOpKind | RetKind;

export const ERROR = Symbol("CONSTRAINT_ERROR");
type ConstraintError = typeof ERROR;
type Constraint = (from: Kind, to: Kind) => Kind | ConstraintError;

export const print = (kind: Kind) => {
  switch (kind.type) {
    case "func":
      return `${
        kind.params.length === 0
          ? "()"
          : `(${kind.params.map(print).join(" ,")})`
      } => ${print(kind.returns)}`;
    default:
      return kind.type;
  }
};

type Node = {
  [k: string]: any
};

type Vertex = {
  kind: Kind,
  node: Node
};

type Edge = {
  from: Vertex,
  to: Vertex
};

type Graph = {
  vertices: Vertex[],
  edges: Edge[]
};

const findVertex = (graph: Graph, node) => {
  const res = graph.vertices.find(vertex => vertex.node === node);
  if (!res) {
    console.log(node);
    throw Error("can't find node");
  }
  return res;
};

const addVertex = (graph: Graph, node) => {
  return {
    ...graph,
    vertices: [...graph.vertices, node]
  };
};

const cloneVertex = (a: Vertex): Vertex => {
  const deepClone = obj =>
    Object.keys(obj).reduce((clone, key) => {
      if (Array.isArray(obj[key])) {
        clone[key] = obj[key].map(deepClone);
      } else if (typeof obj[key] === "object") {
        clone[key] = deepClone(obj[key]);
      } else {
        clone[key] = obj[key];
      }
      return clone;
    }, {});
  return {
    node: a.node,
    kind: deepClone(a.kind),
    copy: true
  };
};

const replaceVertex = (graph: Graph, a: Vertex, b: Vertex) => {
  const pos = graph.vertices.indexOf(a);
  return {
    edges: graph.edges.map(({ from, to }) => ({
      from: from === a ? b : from,
      to: to === a ? b : to
    })),
    vertices: [
      ...graph.vertices.slice(0, pos),
      b,
      ...graph.vertices.slice(pos + 1)
    ]
  };
};

const addEdge = (graph: Graph, { from, to }: Edge) => {
  if (from.node === to.node) {
    throw Error("cannot add edge between same node");
  }
  return {
    ...graph,
    edges: [...graph.edges, { from, to }]
  };
};

const removeEdge = (graph: Graph, edge: Edge) => {
  return {
    ...graph,
    edges: graph.edges.filter(e => e !== edge)
  };
};

const filterEdges = (graph: Graph, fn) => {
  return graph.edges.filter(fn);
};

const createGraph = () => ({
  vertices: [],
  edges: []
});

const mergeGraphs = (a: Graph, b: Graph) => ({
  vertices: [...a.vertices, ...b.vertices],
  edges: [...a.edges, ...b.edges]
});

const follow = (graph, vertex, fn) => {
  const visit = (v, visited = []) => {
    const outgoing = filterEdges(graph, ({ from }) => from === v);
    const incoming = filterEdges(graph, ({ to }) => to === v);
    const unseen = !visited.includes(v);
    if (unseen) {
      fn(v, { outgoing, incoming });
    }
    return incoming.reduce(
      (vs, e) => visit(e.from, vs),
      unseen ? visited.concat(v) : visited
    );
  };
  visit(vertex);
};

const map = (graph, fn) => ({
  vertices: graph.vertices.map(fn),
  edges: graph.edges
});

export const collector = ast => {
  let graph = createGraph();
  traverse(ast, {
    ArrowFunctionExpression: {
      enter(path) {
        const { id, params } = path.node;
        const me: Vertex = {
          node: path.node,
          kind: func(params.map(open))
        };

        graph = addVertex(graph, me);
      },
      exit(path) {
        const me = findVertex(graph, path.node);
        if (path.node.body.type !== "BlockExpression") {
          const body = findVertex(graph, path.node.body);
          const replacement = { ...body, kind: ret(body.kind) };
          graph = replaceVertex(graph, body, replacement);
          graph = addEdge(graph, {
            from: body,
            to: me
          });
        }
        graph = me.node.params
          .map((param, i) => ({
            from: findVertex(graph, param),
            to: me
          }))
          .reduce((g, edge) => addEdge(g, edge), graph);
      }
    },
    BinaryExpression: {
      exit(path) {
        const { left, right } = path.node;
        const me: Vertex = {
          node: path.node,
          kind: binOp()
        };
        path.data.type = me;
        graph = addVertex(graph, me);

        graph = addEdge(graph, {
          from: findVertex(graph, left),
          to: me
        });

        graph = addEdge(graph, {
          from: findVertex(graph, right),
          to: me
        });
      }
    },
    CallExpression: {
      exit(path) {
        const me: Vertex = {
          node: path.node,
          kind: open()
        };
        path.data.type = me;

        graph = addVertex(graph, me);

        graph = addEdge(graph, {
          from: findVertex(graph, me.node.callee),
          to: me
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
          const parentVertex = findVertex(graph, binding.identifier);
          graph = addEdge(graph, {
            from: me,
            to: parentVertex
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
        const me = findVertex(graph, path.node);
        if (path.node.id) {
          const id = findVertex(graph, path.node.id);
          graph = addEdge(graph, {
            from: me,
            to: id
          });
        }
        graph = me.node.params
          .map((param, i) => ({
            from: findVertex(graph, param),
            to: me
          }))
          .reduce((g, edge) => addEdge(g, edge), graph);
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
          kind: ret()
        };
        path.data.type = me;

        graph = addVertex(graph, me);

        const parentFunction = findVertex(graph, path.getFunctionParent().node);
        graph = addEdge(graph, {
          from: me,
          to: parentFunction
        });

        const arg = findVertex(graph, path.node.argument);
        graph = addEdge(graph, {
          from: arg,
          to: me
        });
      }
    },
    StringLiteral: {
      exit(path) {
        const me: Vertex = {
          node: path.node,
          kind: string()
        };
        path.data.type = me;

        graph = addVertex(graph, me);
      }
    },
    VariableDeclarator: {
      exit(path) {
        const { id, init } = path.node;
        graph = addEdge(graph, {
          from: findVertex(graph, init),
          to: findVertex(graph, id)
        });
      }
    }
  });
  return graph;
};

const any = () => true;
const kind = (...tests) => node =>
  tests.reduce((res, test) => res || test(node.kind), false);

// infer the type of vertex in the graph
const infer = (
  graph: Graph,
  vertex: Vertex,
  along: Edge => boolean = ({ to }) => to === vertex
): Graph => {
  const incoming = filterEdges(graph, along);
  return incoming.reduce(narrow, graph);
};

// narrow the type of vertices between edge
const narrow = (graph: Graph, edge: Edge): Graph => {
  if (edge.to === edge.from) {
    throw edge;
  }
  // console.log(edge);
  const { from, to } = edge;
  if (kind(isBinOp)(to) && kind(isInt)(from)) {
    to.kind = binOp(int());
    return graph;
  } else if (kind(isBinOp)(to) && kind(isOpen)(from)) {
    const updated = infer(graph, to, e => e !== edge && e.to === to);
    from.kind = to.kind.result;
    return updated;
  } else if (kind(isFunc)(to) && kind(isRet)(from)) {
    const updated = isOpen(from.kind) ? infer(graph, from) : graph;
    to.kind.returns = from.kind.result;
    return updated;
  } else if (kind(isRet)(to)) {
    const updated = isOpen(from.kind) ? infer(graph, from) : graph;
    to.kind.result = from.kind.result;
    return updated;
  } else if (kind(isFunc)(to)) {
    const updated = isOpen(from.kind) ? infer(graph, from) : graph;
    const pos = to.node.params.indexOf(from.node);
    if (0 <= pos) {
      to.kind = func(
        to.kind.params.map((p, i) => (i === pos ? from.kind : p)),
        to.kind.returns
      );
    }
    return updated;
  } else if (kind(isOpen)(to)) {
    const updated = infer(graph, from);
    to.kind = from.kind.result || from.kind;
    return updated;
  } else if (kind(isInt)(to) && kind(isInt)(from)) {
    return graph;
  }
  throw edge;
};

export const resolver = (graph: Graph) => {
  return (
    graph.vertices
      // infer nodes with the least incoming edges pointing to them
      .sort((a, b) => {
        const incomingCount = v =>
          graph.edges.filter(({ to }) => to === v).length;
        return incomingCount(a) - incomingCount(b);
      })
      .reduce((g, vertex) => {
        // console.log("inferring", vertex.node.type);
        return infer(g, vertex);
        // return g.edges
        //   .filter(({ to }) => to === vertex)
        //   .reduce((updated, { from }) => constrain(updated, from, vertex), g);
      }, graph)
  );
};
