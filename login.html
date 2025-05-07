// src/routes/auth.js

import { Router } from 'express';
import User        from '../models/User.js';
import jwt         from 'jsonwebtoken';
import bcrypt      from 'bcryptjs';

const router = Router();

// Regex institucional Estácio
const estacioRegex = /^[\w.%+-]+@(alunos|professor)\.estacio\.br$/i;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    let { name, email, password, role } = req.body;
    email = email.trim().toLowerCase();

    // Validação de domínio
    if (!estacioRegex.test(email)) {
      return res.status(400).json({
        error: 'E-mail inválido. Use @alunos.estacio.br ou @professor.estacio.br.'
      });
    }

    // Verifica existência de usuário
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Usuário já registrado.' });
    }

    // Hash da senha
    const salt   = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // Cria usuário
    const user = await User.create({
      name,
      email,
      password: hashed,
      role
    });

    // Gera JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao registrar usuário.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const email    = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    // Validação de domínio
    if (!estacioRegex.test(email)) {
      return res.status(400).json({
        error: 'E-mail inválido. Use @alunos.estacio.br ou @professor.estacio.br.'
      });
    }

    // Busca usuário
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Compara senha
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    // Gera token e retorna
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no login.' });
  }
});

export default router;
