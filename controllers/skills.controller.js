import { Skill } from '../models/index.js';

export async function getSkills(req, res, next) {
  try {
    const skills = await Skill.findAll();
    res.json(skills);
  } catch (err) {
    next(err);
  }
}

export async function createSkill(req, res, next) {
  try {
    const { name } = req.body;
    const skill = await Skill.create({ name });
    res.status(201).json(skill);
  } catch (err) {
    next(err);
  }
}
