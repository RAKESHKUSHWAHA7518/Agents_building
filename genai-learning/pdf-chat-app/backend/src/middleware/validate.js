// src/middleware/validate.js — Request body validation using a zod schema.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        details: result.error.flatten().fieldErrors,
      },
    });
  }
  req.body = result.data; // use parsed (trimmed/coerced) data downstream
  next();
};
