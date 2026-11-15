import { LEVELS } from './constants.js';

export function canAccess(user, target) {
  if (!user) return { ok: false, reason: 'Rosto não reconhecido' };
  if (user.level === 3) return { ok: true };
  if (target.level === 1) return { ok: true };
  if (target.level === 2) {
    if (user.level === 2 && user.division === target.division) return { ok: true };
    return {
      ok: false,
      reason:
        user.level === 2
          ? `Diretor de outra divisão (${user.division})`
          : 'Permissão insuficiente para compartimento de divisão',
    };
  }
  return { ok: false, reason: 'Compartimento exclusivo do ministro' };
}

export function targetLabel(t) {
  if (!t || !t.level) return 'Não identificado';
  if (t.level === 2) return `Nível 2 · ${t.division}`;
  return `${LEVELS[t.level].short} · ${LEVELS[t.level].title}`;
}

/** Valida cadastro */
export function validateUser(form, users, editingId) {
  const errors = [];
  if (!form.name.trim() || form.name.trim().length < 3) errors.push('Informe o nome completo (mínimo 3 letras).');
  if (!form.role.trim()) errors.push('Informe o cargo.');
  if (form.level === 2 && !form.division) errors.push('Diretores (Nível 2) precisam de uma divisão.');
  if (form.level === 3) {
    const other = users.find((u) => u.level === 3 && u.id !== editingId);
    if (other) errors.push(`O Nível 3 é exclusivo do ministro e já está ocupado por ${other.name}.`);
  }
  if (form.level === 2) {
    const dup = users.find((u) => u.level === 2 && u.division === form.division && u.id !== editingId);
    if (dup) errors.push(`A divisão "${form.division}" já tem diretor cadastrado (${dup.name}).`);
  }
  return errors;
}
