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

type Type = IntType | BoolType | FuncType | VarType;

type Scheme = { vars: string[], type: Type };
const createScheme = (vars: string[], type: Type): Scheme => ({
  vars,
  type
});

type Context = { [id: string]: Scheme };
const createCtx = (): Context => ({});

type Substitution = { [id: string]: Type };
const emptySubst = (): Substitution => ({});
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
  return {
    ...s1,
    ...Object.keys(s2).reduce((subst, k) => {
      subst[k] = applySubst(s1, s2[k]);
      return subst;
    }, {})
  };
};

const instantiate = ({ vars, type }: Scheme): Type => {
  const newVars = vars.map(varT);
  const subst: Substitution = vars.reduce((s, v, i) => {
    s[v] = newVars[i];
    return s;
  }, {});
  return applySubst(subst, type);
};

const varBind = (id: string, ty: Type): Substitution => {
  // a U a
  if (id === ty.name) {
    return emptySubst();
  } else if (
    isFuncT(ty) &&
    (ty.params.find(p => isVarT(p) && p.name === id) ||
      (isVarT(ty.returns) && ty.returns.name === id))
  ) {
    throw `${id} occurs in more complex type ${ty.name}`;
  }
  return {
    [id]: ty
  };
};

const unify = (ty1: Type, ty2: Type): Substitution => {
  if (isIntT(ty1) && isIntT(ty2)) {
    return emptySubst();
  } else if (isBoolT(ty1) && isBoolT(ty2)) {
    return emptySubst();
  } else if (
    isFuncT(ty1) &&
    isFuncT(ty2) &&
    ty1.params.length === ty2.params.length
  ) {
    const s1 = ty1.params.reduce(
      (subst, p1, i) => composeSubst(subst, unify(p1, ty2.params[i])),
      emptySubst()
    );
    const s2 = unify(applySubst(s1, ty1.returns), applySubst(s1, ty2.returns));
    return composeSubst(s1, s2);
  } else if (isVarT(ty1)) {
    return varBind(ty1.id, ty2);
  } else if (isVarT(ty2)) {
    return varBind(ty2.id, ty1);
  }
  throw `types do not unify: ${ty1.name} and ${ty2.name}`;
};

const getId = node =>
  `${node.loc.start.line}${node.loc.start.column}${node.loc.end.line}${
    node.loc.end.column
  }`;

const emptyState = () => ({
  context: createCtx(),
  getVarTId: (() => {
    let id = 0;
    return () => `$${++id}`;
  })(),
  skip: p => false
});

export const collector = ast => {
  let nodes = {};
  const visitor = {
    enter(path, state = emptyState()) {
      if (state.skip(path)) {
        path.skip();
        return;
      }
    },
    BooleanLiteral(path, state = emptyState()) {
      path.data = {
        subst: emptySubst(),
        type: boolT()
      };
      nodes[getId(path.node)] = {
        node: path.node,
        ...path.data
      };
    },
    CallExpression(path, state = emptyState()) {
      // console.log("CallExpression");
      const tyRes = varT(state.getVarTId());

      path.traverse(visitor, {
        ...state,
        skip: p => path.node.arguments.includes(p.node)
      });
      const { subst: s1, type: tyFun } = path.get("callee").data;

      path.traverse(visitor, {
        ...state,
        context: applySubstContext(s1, state.context),
        skip: p => p.node === path.node.callee
      });

      const tyArgs = path.get("arguments").map(arg => arg.data);
      const s2 = tyArgs.reduce((s, { subst }) => {
        return composeSubst(s, subst);
      }, emptySubst());

      const s3 = unify(
        applySubst(s2, tyFun),
        funcT(tyArgs.map(a => a.type), tyRes)
      );

      const subst = composeSubst(s3, composeSubst(s2, s1));

      path.data = {
        subst: subst,
        type: applySubst(subst, tyRes)
      };
      nodes[getId(path.node)] = {
        node: path.node,
        ...path.data
      };
      path.skip();
    },
    Function(path, state = emptyState()) {
      // console.log("Function");
      const paramTypes = path.node.params.map(p => varT(p.name));
      let tempContext = state.context;
      paramTypes.forEach(param => {
        tempContext[param.id] = createScheme([], param);
      });
      path.traverse(visitor, {
        ...state,
        context: tempContext,
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
    Identifier(path, state = emptyState()) {
      // console.log("Identifier");
      const scheme = state.context[path.node.name];
      if (!scheme) throw "node not found in scheme";
      path.data = {
        subst: emptySubst(),
        type: instantiate(scheme)
      };
      nodes[getId(path.node)] = {
        node: path.node,
        ...path.data
      };
    },
    NumericLiteral(path, state = emptyState()) {
      // console.log("NumericLiteral");
      path.data = {
        subst: emptySubst(),
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
