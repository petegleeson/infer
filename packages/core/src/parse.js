// @flow
const toObj = obj => (res, k) => (res[k] = obj[k]);

const alphabet = "abcdefghijklmnopqrstuvwxyz";
export const prettyPrint = (ty: Type): string => {
  if (isBoolT(ty)) {
    return ty.name;
  } else if (isIntT(ty)) {
    return ty.name;
  } else if (isStrT(ty)) {
    return ty.name;
  } else if (isVarT(ty)) {
    return alphabet[parseInt(ty.id.split("$")[1], 10) - 1];
  } else if (isFuncT(ty)) {
    return `(${ty.params.map(prettyPrint).join(", ")}) => ${prettyPrint(
      ty.returns
    )}`;
  } else if (isObjT(ty)) {
    return `{ ${ty.properties
      .map(([key, tyValue]) => `${key}: ${prettyPrint(tyValue)}`)
      .join(", ")} }`;
  }
  throw `don't know how to print ${ty.name}`;
};

/* TYPES */

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

type ObjType = { name: "obj", properties: [string, Type][] };
export const objT = (properties: [string, Type][]): ObjType => ({
  name: "obj",
  properties
});
const isObjT = (ty: Type) => ty.name === "obj";

type StrType = { name: "str" };
export const strT = (): StrType => ({ name: "str" });
const isStrT = (ty: Type) => ty.name === "str";

type VarType = { name: "var", id: string };
export const varT = (id: string): VarType => ({ name: "var", id });
const isVarT = (ty: Type) => ty.name === "var";

type VoidType = { name: "void" };
export const voidT = (): VoidType => ({ name: "void" });

export type Type =
  | IntType
  | BoolType
  | FuncType
  | ObjType
  | VarType
  | VoidType
  | StrType;

type Scheme = { vars: string[], type: Type };
const createScheme = (vars: string[], type: Type): Scheme => ({
  vars,
  type
});

export type Context = { [id: string]: Scheme };
export const createCtx = (): Context => ({});

export type Substitution = { [id: string]: Type };
export const emptySubst = (): Substitution => ({});
const deleteSubst = (subst: Substitution, keys: string[]): Substitution =>
  Object.keys(subst)
    .filter(k => !keys.includes(k))
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
  } else if (isStrT(ty)) {
    return ty;
  } else if (isObjT(ty)) {
    return objT(
      ty.properties.map(([name, tyProp]) => [name, applySubst(subst, tyProp)])
    );
  }
  throw `cannot apply substution to ${ty.name}`;
};

const applySubstScheme = (
  subst: Substitution,
  { vars, type }: Scheme
): Scheme => {
  return createScheme(vars, applySubst(deleteSubst(subst, vars), type));
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
  } else if (isStrT(ty1) && isStrT(ty2)) {
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

const pathData = (subst: Substitution, type: Type) => {
  if (typeof subst !== "object") throw `subst is not an object`;
  return {
    subst,
    type
  };
};

export type VisitResult = {
  subst: Substitution,
  type: Type
};

type Obj = { [k: string]: any };

export type VisitorApi = {
  visit: (Obj, Context) => VisitResult,
  getVarTId: () => string
};

export type Visitor = {
  [k: string]: (
    path: { node: Obj },
    context: Context,
    api: VisitorApi
  ) => VisitResult
};

export const visitor: Visitor = {
  BooleanLiteral(path, state) {
    return pathData(emptySubst(), boolT());
  },
  CallExpression(path, context, { visit, getVarTId }) {
    // console.log("CallExpression");
    const tyRes = varT(getVarTId());

    const { subst: s1, type: tyFun } = visit(path.node.callee, context);
    const args = path.node.arguments.map(n => visit(n, context));

    const tyArgs = args.map(a => a.type);
    const s2 = args.reduce((s, { subst }) => {
      return composeSubst(s, subst);
    }, emptySubst());

    const s3 = unify(applySubst(s2, tyFun), funcT(tyArgs, tyRes));

    const subst = composeSubst(s3, composeSubst(s2, s1));

    return pathData(subst, applySubst(subst, tyRes));
  },
  ExpressionStatement(path, state, { visit }) {
    // console.log("ExpressionStatement");
    return visit(path.node.expression, state);
  },
  Function(path, context, { visit, getVarTId }) {
    // console.log("Function");
    // add params to context
    const funcContext = path.node.params.reduce(
      (ctx, n) =>
        Object.assign(ctx, { [n.name]: createScheme([], varT(getVarTId())) }),
      context
    );
    // infer params type
    let paramSubst = emptySubst();
    const paramTypes = path.node.params.map(n => {
      const { subst, type } = visit(
        n,
        applySubstContext(paramSubst, funcContext)
      );
      paramSubst = composeSubst(paramSubst, subst);
      return type;
    });
    // infer body type
    const { subst: bodySubst, type: bodyType } = visit(
      path.node.body,
      funcContext
    );

    // unify param and body substitutions
    const composedSubst = unify(
      applySubst(paramSubst, funcT(paramTypes, bodyType)),
      applySubst(bodySubst, funcT(paramTypes, bodyType))
    );
    console.log(applySubst(composedSubst, funcT(paramTypes, bodyType)));

    return pathData(
      composedSubst,
      applySubst(composedSubst, funcT(paramTypes, bodyType))
    );
  },
  Identifier(path, context) {
    // console.log("Identifier", path.node.name);
    const scheme = context[path.node.name];
    if (!scheme) throw `${path.node.name} not found in scheme`;
    return pathData(emptySubst(), instantiate(scheme));
  },
  NumericLiteral(path, context) {
    // console.log("NumericLiteral");
    return pathData(emptySubst(), intT());
  },
  "Program|BlockStatement"(path, context, { visit, getVarTId }) {
    // console.log("Program|BlockStatement");
    const bodyContext = Object.keys({}).reduce((ctx, binding) => {
      ctx[binding] = createScheme([], varT(getVarTId()));
      return ctx;
    }, context);
    const composedSubst = path.node.body.reduce((subst, node, i) => {
      // infer
      return composeSubst(
        subst,
        visit(node, applySubstContext(subst, bodyContext)).subst
      );
    }, emptySubst());

    return pathData(composedSubst, voidT());
  },
  ObjectExpression(path, state = emptyState()) {
    const obj = path.node.properties.reduce(
      ({ subst, type }, prop, i) => {
        path.traverse(visitor, {
          ...state,
          context: applySubstContext(subst, state.context),
          skip: p => p.node !== prop
        });
        const { subst: objSubst, type: tyObj } = path.get(
          `properties.${i}`
        ).data;
        const [[key, tyValue]] = tyObj.properties;
        let composedSubst = composeSubst(subst, objSubst);
        // merge each obj prop type into this obj type
        return {
          subst: composedSubst,
          type: objT([...type.properties, [key, tyValue]])
        };
      },
      { subst: emptySubst(), type: objT([]) }
    );

    path.data = pathData(obj.subst, obj.type);
    path.skip();
  },
  ObjectProperty(path, state = emptyState()) {
    // infer value
    path.traverse(visitor, {
      ...state,
      skip: p => p.node === path.node.key
    });
    const { subst: valSubst, type: tyVal } = path.get("value").data;
    // infer key
    path.traverse(visitor, {
      ...state,
      context: applySubstContext(
        valSubst,
        Object.assign(state.context, {
          [path.node.key.name]: createScheme([], varT(state.getVarTId()))
        })
      ),
      skip: p => p.node === path.node.value
    });
    const { subst: keySubst, type: tyKey } = path.get("key").data;

    const subst = unify(applySubst(keySubst, tyKey), tyVal);

    path.data = pathData(
      subst,
      objT([[path.node.key.name, applySubst(subst, tyKey)]])
    );
    nodes[getId(path.node.key)].type = applySubst(subst, tyKey);
    path.skip();
  },
  StringLiteral(path, state = emptyState()) {
    path.data = pathData(emptySubst(), strT());
    nodes[getId(path.node)] = {
      node: path.node,
      ...path.data
    };
  },
  VariableDeclaration(path, state = emptyState()) {
    // console.log("VariableDeclaration");
    const composedSubst = path.node.declarations.reduce((subst, _, i) => {
      // infer
      path.traverse(visitor, {
        ...state,
        context: applySubstContext(subst, state.context),
        skip: p => p.node !== path.node.declarations[i]
      });
      const { subst: s1 } = path.get(`declarations.${i}`).data;
      return composeSubst(subst, s1);
    }, emptySubst());

    path.data = pathData(composedSubst, voidT());
    path.skip();
  },
  VariableDeclarator(path, state = emptyState()) {
    // console.log("VariableDeclarator");
    // infer rhs
    path.traverse(visitor, {
      ...state,
      skip: p => p.node === path.node.id
    });
    const { subst: s1, type: tyRhs } = path.get("init").data;
    // infer lhs
    path.traverse(visitor, {
      ...state,
      context: applySubstContext(s1, state.context),
      skip: p => p.node === path.node.init
    });
    const { subst: s2, type: tyLhs } = path.get("id").data;

    const subst = unify(applySubst(s2, tyLhs), tyRhs);
    path.data = pathData(subst, voidT());
    // update the type of the id node
    nodes[getId(path.node.id)].type = applySubst(
      subst,
      nodes[getId(path.node.id)].type
    );
    path.skip();
  }
};
