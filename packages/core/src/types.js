// @flow

type BoolType = { uid: string, name: "bool" };
export const boolT = (uid: string): BoolType => ({ name: "bool", uid });
export const isBoolT = (ty: Type) => ty.name === "bool";

type FuncType = { uid: string, name: "func", params: Type[], returns: Type };
export const funcT = (
  uid: string,
  params: Type[],
  returns: Type
): FuncType => ({
  name: "func",
  uid,
  params,
  returns
});
export const isFuncT = (ty: Type) => ty.name === "func";

type IntType = { uid: string, name: "int" };
export const intT = (uid: string): IntType => ({ name: "int", uid });
export const isIntT = (ty: Type) => ty.name === "int";

type ObjType = { uid: string, name: "obj", properties: [string, Type][] };
export const objT = (uid: string, properties: [string, Type][]): ObjType => ({
  name: "obj",
  uid,
  properties
});
export const isObjT = (ty: Type) => ty.name === "obj";

type StrType = { uid: string, name: "str" };
export const strT = (uid: string): StrType => ({ name: "str", uid });
export const isStrT = (ty: Type) => ty.name === "str";

type VarType = { uid: string, name: "var" };
export const varT = (uid: string): VarType => ({ name: "var", uid });
export const isVarT = (ty: Type) => ty.name === "var";

type VoidType = { uid: string, name: "void" };
export const voidT = (uid: string): VoidType => ({ name: "void", uid });
export const isVoidT = (ty: Type) => ty.name === "void";

export type Type =
  | IntType
  | BoolType
  | FuncType
  | ObjType
  | VarType
  | VoidType
  | StrType;

export const getTypes = (nextId: () => string) => ({
  boolT: (...args) => boolT(nextId(), ...args),
  intT: (...args) => intT(nextId(), ...args),
  funcT: (...args) => funcT(nextId(), ...args),
  objT: (...args) => objT(nextId(), ...args),
  strT: (...args) => strT(nextId(), ...args),
  varT: (...args) => varT(nextId(), ...args),
  voidT: (...args) => voidT(nextId(), ...args)
});
