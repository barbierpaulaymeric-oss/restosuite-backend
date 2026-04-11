const { validationResult, body } = require('express-validator');

/**
 * Runs express-validator chains and returns 400 with errors if any fail.
 * Usage: router.post('/path', validate([body('field').notEmpty()]), handler)
 */
function validate(chains) {
  return [
    ...chains,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
      }
      next();
    }
  ];
}

// ─── Reusable validation chains ───

const recipeValidation = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('portions').optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('portions must be a positive integer'),
  body('selling_price').optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('selling_price must be a non-negative number'),
];

const ingredientValidation = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('price_per_unit').optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('price_per_unit must be a non-negative number'),
  body('waste_percent').optional({ nullable: true })
    .isFloat({ min: 0, max: 100 }).withMessage('waste_percent must be between 0 and 100'),
];

const stockReceptionValidation = [
  body('lines').isArray({ min: 1 }).withMessage('Au moins une ligne de réception est requise'),
  body('lines.*.ingredient_id').notEmpty().withMessage('ingredient_id requis pour chaque ligne'),
  body('lines.*.quantity').isFloat({ gt: 0 }).withMessage('quantity must be a positive number'),
  body('lines.*.unit').notEmpty().withMessage('unit requis pour chaque ligne'),
  body('lines.*.unit_price').optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('unit_price must be a non-negative number'),
];

const customerValidation = [
  body('name').trim().notEmpty().withMessage('Nom requis'),
  body('email').optional({ nullable: true, checkFalsy: true })
    .isEmail().withMessage('Format email invalide'),
];

module.exports = { validate, recipeValidation, ingredientValidation, stockReceptionValidation, customerValidation };
