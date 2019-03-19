// @flow
import traverse from "@babel/traverse";
import * as t from "@babel/types";

const toObj = obj => (res, k) => (res[k] = obj[k]);

type BoolType = { name: "bool" };
export const boolT = (): BoolType => ({ name: "bool" });
const isBoolT = (ty: Type) => ty.name === "bool";

type FuncType = { name: "func", params: Type[], returns: Type };
export const funcT = (params: Type[], returns: Type): FuncType => ({
  name: "func",
  params,
  returns
});
const isFuncT = (ty: Type) => ty.name === "func";

type IntType = { name: "int" };
export const intT = (): IntType => ({ name: "int" });
const isIntT = (ty: Type) => ty.name === "int";

type VarType = { name: "var", id: string };
export const varT = (id: string): VarType => ({ name: "var", id });
const isVarT = (ty: Type) => ty.name === "var";
const getVarTId = (() => {
  let id = 0;
  return () => `$${++id}`;
})();

type Type = IntType | BoolType | FuncType | VarType;

type Scheme = { vars: string[], type: Type };
const createScheme = (vars: string[], type: Type): Scheme => ({
  vars,
  type
});

type Context = { [id: string]: Scheme };
const createCtx = (): Context => ({});

type Substitution = { [id: string]: Type };
const createSubst = (): Substitution => ({});
const deleteSubst = (subst, keys): Substitution =>
  Object.keys(subst)
    .filter(k => keys.includes(k))
    .reduce((res, k) => {
      res[k] = subst[k];
      return res;
    }, {});

const applySubst = (subst: Substitution, ty: Type): Type => {
  if (isVarT(ty)) {
    return subst[ty.id] || ty;
  } else if (isFuncT(ty)) {
    return funcT(
      ty.params.map(pty => applySubst(subst, pty)),
      applySubst(subst, ty.returns)
    );
  } else if (isBoolT(ty)) {
    return ty;
  } else if (isIntT(ty)) {
    return ty;
  }
  throw ty;
};

const applySubstScheme = (
  subst: Substitution,
  { vars, type }: Scheme
): Scheme => {
  return createScheme(
    vars,
    applySubst(deleteSubst(subst, vars.map(v => v.id)), type)
  );
};

const applySubstContext = (subst: Substitution, ctx: Context): Context =>
  Object.keys(ctx).reduce((res, k) => {
    res[k] = applySubstScheme(subst, ctx[k]);
    return res;
  }, {});

const composeSubst = (s1: Substitution, s2: Substitution): Substitution => {
  throw s1;
  return createSubst();
};

const instantiate = ({ vars, type }: Scheme): Type => {
  const newVars = vars.map(varT);
  const subst: Substitution = vars.reduce((s, v, i) => {
    s[v] = newVars[i];
    return s;
  }, {});
  return applySubst(subst, type);
};

const getId = node =>
  `${node.loc.start.line}${node.loc.start.column}${node.loc.end.line}${
    node.loc.end.column
  }`;

const emptyState = {
  context: createCtx(),
  skip: p => false
};

export const collector = ast => {
  let nodes = {};
  const visitor = {
    BooleanLiteral(path, state = emptyState) {
      if (state.skip(path)) {
        path.skip();
        return;
      }
      path.data = {
        subst: createSubst(),
        type: boolT()
      };
      nodes[getId(path.node)] = {
        node: path.node,
        ...path.data
      };
    },
    CallExpression(path, state = emptyState) {
      if (state.skip(path)) {
        path.skip();
        return;
      }
      console.log("CallExpression");
      const tyRes = varT(getVarTId());
      const callee = path.get("callee");
      path.traverse(visitor, {
        ...state,
        skip: p => path.node.arguments.includes(p.node)
      });
      console.log("traversing again");
      path.traverse(visitor, {
        ...state,
        skip: p => p.node === callee.node
      });
      // path.get("callee").traverse(visitor, state);
      // console.log(path.get("callee").data);
      path.skip();
    },
    Function(path, state = emptyState) {
      if (state.skip(path)) {
        path.skip();
        return;
      }
      console.log("Function");
      const paramTypes = path.node.params.map(p => varT(p.name));
      let tempContext = state.context;
      paramTypes.forEach(param => {
        tempContext[param.id] = createScheme([], param);
      });
      // ideally skip params like: path.get('body').traverse(visitor, state)
      path.traverse(visitor, {
        ...state,
        skip: p => path.node.params.includes(p.node)
      });
      const { subst: s1, type: bodyType } = path.get("body").data;
      path.data = {
        subst: s1,
        type: funcT(paramTypes.map(param => applySubst(s1, param)), bodyType)
      };
      nodes[getId(path.node)] = {
        node: path.node,
        ...path.data
      };
      path.skip();
    },
    Identifier(path, state = emptyState) {
      if (state.skip(path)) {
        path.skip();
        return;
      }
      console.log("Identifier");
      const scheme = state.context[path.node.name];
      // console.log(path.node);
      // console.log(path.parent.params);
      // console.log("scheme", scheme);
      if (!scheme) throw "node not found in scheme";
      path.data = {
        subst: createSubst(),
        type: instantiate(scheme)
      };
      nodes[getId(path.node)] = {
        node: path.node,
        ...path.data
      };
    },
    NumericLiteral(path, state = emptyState) {
      if (state.skip(path)) {
        path.skip();
        return;
      }
      console.log("NumericLiteral");
      path.data = {
        subst: createSubst(),
        type: intT()
      };
      nodes[getId(path.node)] = {
        node: path.node,
        ...path.data
      };
    }
  };

  traverse(ast, visitor);
  return nodes;
};

const constrain = (graph: Graph, vertex: Vertex): Vertex => {
  const edges = graph.edges.filter(({ to }) => to === vertex);
  if (edges.length === 0) {
    return vertex;
  }
  // infer vertex type
  const kind = edges.reduce(
    (k, edge) => edge.constraint(constrain(graph, edge.from).kind, k),
    vertex.kind
  );
  return { ...vertex, kind };
};

export const resolver = (graph: Graph) => {
  return graph.vertices.reduce((g, vertex) => {
    const updated = constrain(g, vertex);
    return replaceVertex(g, vertex, updated);
  }, graph);
};
