// @flow
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import {
  isBoolT,
  isErrT,
  isIntT,
  isStrT,
  isVarT,
  isFuncT,
  isObjT,
  isVoidT,
  getTypes,
  funcT,
  objT,
  varT,
  type Type
} from "./types";

const toObj = obj => (res, k) => (res[k] = obj[k]);

const alphabet = "abcdefghijklmnopqrstuvwxyz";
export const prettyPrint = (type: Type): string => {
  let nextLetter = 0;
  let varLetterMap = {};
  const print = (ty: Type) => {
    if (isBoolT(ty)) {
      return ty.name;
    } else if (isIntT(ty)) {
      return ty.name;
    } else if (isStrT(ty)) {
      return ty.name;
    } else if (isVarT(ty)) {
      if (!varLetterMap[ty.uid]) {
        varLetterMap[ty.uid] = alphabet[nextLetter];
        nextLetter = (nextLetter + 1) % alphabet.length;
      }
      return varLetterMap[ty.uid];
    } else if (isFuncT(ty)) {
      return `(${ty.params.map(print).join(", ")}) => ${print(ty.returns)}`;
    } else if (isObjT(ty)) {
      return `{ ${ty.properties
        .map(([key, tyValue]) => `${key}: ${prettyPrint(tyValue)}`)
        .join(", ")} }`;
    } else if (isVoidT(ty)) {
      return "";
    } else if (isErrT(ty)) {
      return `err: expected ${print(ty.upper)} and got ${print(ty.lower)}`;
    }
    throw `don't know how to print ${ty.name}`;
  };
  return print(type);
};

type Scheme = { vars: string[], type: Type };
const createScheme = (vars: string[], type: Type): Scheme => ({
  vars,
  type
});

type Context = { [id: string]: Scheme };
export const createCtx = (): Context => ({});

type Substitution = { [id: string]: Type };
export const emptySubst = (): Substitution => ({});
const deleteSubst = (subst: Substitution, keys: string[]): Substitution =>
  Object.keys(subst)
    .filter(k => !keys.includes(k))
    .reduce((res, k) => {
      res[k] = subst[k];
      return res;
    }, {});

export const applySubst = (subst: Substitution, ty: Type): Type => {
  if (subst[ty.uid] && isErrT(subst[ty.uid])) {
    return subst[ty.uid];
  } else if (isVarT(ty)) {
    return subst[ty.uid] || ty;
  } else if (isFuncT(ty)) {
    return funcT(
      ty.uid,
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
      ty.uid,
      ty.properties.map(([name, tyProp]) => [name, applySubst(subst, tyProp)])
    );
  } else if (isErrT(ty)) {
    return ty;
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

const freeTypeVars = (ty: Type): string[] => {
  if (isVarT(ty)) {
    return [ty.uid];
  } else if (isFuncT(ty)) {
    return ty.params
      .reduce((c, p) => c.concat(freeTypeVars(p)), [])
      .concat(freeTypeVars(ty.returns));
  }
  return [];
};

const freeTypeVarsScheme = (scheme: Scheme): string[] => {
  return freeTypeVars(scheme.type).filter(v => !scheme.vars.includes(v));
};

const freeTypeVarsContext = (context: Context): string[] => {
  return Object.values(context).reduce(
    (curr, s) => curr.concat(freeTypeVarsScheme(s)),
    []
  );
};

const generalise = (context: Context, ty: Type) =>
  createScheme(
    freeTypeVars(ty).filter(v => !freeTypeVarsContext(context).includes(v)),
    ty
  );

const instantiate = ({ vars, type }: Scheme, varT): Type => {
  const newVars = vars.map(varT);
  const subst: Substitution = vars.reduce((s, v, i) => {
    s[v] = newVars[i];
    return s;
  }, {});
  return applySubst(subst, type);
};

const varBind = (id: string, ty: Type): Substitution => {
  // a U a
  if (id === ty.uid) {
    return emptySubst();
  } else if (
    isFuncT(ty) &&
    (ty.params.find(p => isVarT(p) && p.name === id) ||
      (isVarT(ty.returns) && ty.returns.name === id))
  ) {
    throw `${id} occurs in more complex type ${ty.uid}`;
  }
  return {
    [id]: ty
  };
};

const unify = (ty1: Type, ty2: Type, errT): Substitution => {
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
      (subst, p1, i) => composeSubst(subst, unify(p1, ty2.params[i], errT)),
      emptySubst()
    );
    const s2 = unify(
      applySubst(s1, ty1.returns),
      applySubst(s1, ty2.returns),
      errT
    );
    return composeSubst(s1, s2);
  } else if (isVarT(ty1)) {
    return varBind(ty1.uid, ty2);
  } else if (isVarT(ty2)) {
    return varBind(ty2.uid, ty1);
  } else {
    return {
      [ty1.uid]: errT(ty1, ty2)
    };
  }
  throw `types do not unify: ${ty1.name} and ${ty2.name}`;
};

const getId = node =>
  `${node.loc.start.line}${node.loc.start.column}${node.loc.end.line}${node.loc.end.column}`;

const pathData = (subst: Substitution, type: Type) => {
  if (typeof subst !== "object") throw `subst is not an object`;
  return {
    subst,
    type
  };
};

const emptyState = () => {
  const nextId = (() => {
    let id = 0;
    return () => `${++id}`;
  })();
  return {
    context: createCtx(),
    types: getTypes(nextId),
    skip: p => false
  };
};

type Node = { [k: string]: any };

export type Result = {
  subst: Substitution,
  type: Type
};

export type Api = {
  visit: (Node, Context) => Result,
  types: $Call<typeof getTypes, () => "">
};

export type VisitorFn = (
  path: { node: Node },
  context: Context,
  api: Api
) => Result;

export type Visitor = {
  [k: string]: VisitorFn
};

export const visitor: Visitor = {
  BooleanLiteral(path, context, { types }) {
    return pathData(emptySubst(), types.boolT());
  },
  CallExpression(path, context, { visit, types }) {
    // console.log("CallExpression");
    const tyRes = types.varT();

    const { subst: calleeSubst, type: tyCallee } = visit(
      path.node.callee,
      context
    );
    const generalisedtyCallee = instantiate(
      generalise(context, tyCallee),
      types.varT
    );

    const args = path.node.arguments.map(n => visit(n, context));

    const tyArgs = args.map(a => a.type);
    const s2 = args.reduce((s, { subst }) => {
      return composeSubst(s, subst);
    }, emptySubst());

    const s3 = unify(
      types.funcT(tyArgs, tyRes),
      applySubst(s2, generalisedtyCallee),
      types.errT
    );

    const subst = composeSubst(s3, composeSubst(s2, calleeSubst));
    return pathData(subst, applySubst(subst, tyRes));
  },
  Function(path, context, { visit, types }) {
    // console.log("Function");
    // add params to context
    const funcContext = path.node.params.reduce(
      (ctx, n) => ({
        ...ctx,
        [n.name]: createScheme([], types.varT())
      }),
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
      applySubst(paramSubst, types.funcT(paramTypes, bodyType)),
      applySubst(bodySubst, types.funcT(paramTypes, bodyType)),
      types.errT
    );

    return pathData(
      composeSubst(paramSubst, bodySubst),
      applySubst(composedSubst, types.funcT(paramTypes, bodyType))
    );
  },
  Identifier(path, context, { types }) {
    // console.log("Identifier", path.node.name);
    const scheme = context[path.node.name];
    if (!scheme) throw `${path.node.name} not found in scheme`;
    return pathData(emptySubst(), instantiate(scheme, types.varT));
  },
  NumericLiteral(path, context, { types }) {
    // console.log("NumericLiteral");
    return pathData(emptySubst(), types.intT());
  },
  "Program|BlockStatement"(path, context, { visit, types }) {
    // console.log("Program|BlockStatement");
    const getIds = node => {
      const visitor = {
        VariableDeclaration() {
          return node.declarations.map(getIds);
        },
        VariableDeclarator() {
          return node.id.name;
        }
      };
      return visitor[node.type] ? visitor[node.type]() : [];
    };
    // flatMap ids
    const ids = path.node.body.reduce((curr, n) => curr.concat(getIds(n)), []);
    const blockContext = ids.reduce(
      (ctx, id) => ({
        ...ctx,
        [id]: createScheme([], types.varT())
      }),
      context
    );
    const composedSubst = path.node.body.reduce((subst, node, i) => {
      // infer
      return composeSubst(
        subst,
        visit(node, applySubstContext(subst, blockContext)).subst
      );
    }, emptySubst());

    return pathData(composedSubst, types.voidT());
  },
  ObjectExpression(path, context, { visit, types }) {
    const obj = path.node.properties.reduce(
      ({ subst, type }, prop, i) => {
        const updatedContext = applySubstContext(subst, context);
        const { subst: objSubst, type: tyObj } = visit(prop, updatedContext);
        const [[key, tyValue]] = tyObj.properties;
        let composedSubst = composeSubst(subst, objSubst);
        // merge each obj prop type into this obj type
        return {
          subst: composedSubst,
          type: types.objT([...type.properties, [key, tyValue]])
        };
      },
      { subst: emptySubst(), type: types.objT([]) }
    );

    return pathData(obj.subst, obj.type);
  },
  ObjectProperty(path, context, { visit, types }) {
    // infer value
    const { subst: valSubst, type: tyVal } = visit(path.node.value, context);
    // infer key
    const updatedCtx = applySubstContext(valSubst, {
      ...context,
      [path.node.key.name]: createScheme([], types.varT())
    });
    const { subst: keySubst, type: tyKey } = visit(path.node.key, updatedCtx);

    const subst = unify(applySubst(keySubst, tyKey), tyVal, types.errT);

    return pathData(
      subst,
      types.objT([[path.node.key.name, applySubst(subst, tyKey)]])
    );
  },
  StringLiteral(path, context, { types }) {
    return pathData(emptySubst(), types.strT());
  },
  VariableDeclarator(path, context, { visit, types }) {
    // console.log("VariableDeclarator");
    // infer rhs
    const { subst: rhsSubst, type: tyRhs } = visit(path.node.init, context);
    // infer lhs
    const { subst: lhsSubst, type: tyLhs } = visit(
      path.node.id,
      applySubstContext(rhsSubst, context)
    );

    const subst = unify(applySubst(lhsSubst, tyLhs), tyRhs, types.errT);
    return pathData(subst, types.voidT());
  }
};
