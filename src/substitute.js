'use strict';

const { Let, Operation, FunCall } = require('./expressions');
const {
  isLiteral,
  isOperation,
  isVariable,
  isLetIn,
  isFunCall,
} = require('./is');

const subIntoOperation = (value, name, expr) => {
  const { leftExpr, op, rightExpr } = expr;
  return new Operation(
    substitute(value, name, leftExpr),
    op,
    substitute(value, name, rightExpr),
  );
};

const subIntoLetIn = (value, name, expr) => {
  return new Let(
    expr.name,
    substitute(value, name, expr.headExpr),
    // shadow
    expr.name === name ? expr.bodyExpr : substitute(value, name, expr.bodyExpr),
  );
};

const subIntoFunCall = (value, name, expr) => {
  const { funExpr, argExpr } = expr;
  return new FunCall(
    substitute(value, name, funExpr),
    substitute(value, name, argExpr),
  );
};

const substitute = (value, name, expr) => {
  if (isLiteral(expr)) return expr;
  if (isVariable(expr) && expr.name === name) return value;
  if (isOperation(expr)) return subIntoOperation(value, name, expr);
  if (isLetIn(expr)) return subIntoLetIn(value, name, expr);
  if (isFunCall(expr)) return subIntoFunCall(value, name, expr);
  return expr;
};

module.exports = substitute;
