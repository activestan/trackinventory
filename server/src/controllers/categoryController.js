const Category = require('../models/Category');

async function listCategories(req, res) {
  try {
    const categories = await Category.find().sort({ category_name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories.', error: error.message });
  }
}

async function createCategory(req, res) {
  try {
    const { category_name, description } = req.body;
    if (!category_name) {
      return res.status(400).json({ message: 'category_name is required.' });
    }
    const category = await Category.create({ category_name, description });
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error creating category.', error: error.message });
  }
}

async function updateCategory(req, res) {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Error updating category.', error: error.message });
  }
}

async function deleteCategory(req, res) {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    res.json({ message: 'Category deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting category.', error: error.message });
  }
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
