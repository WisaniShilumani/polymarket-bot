import jwt from 'jsonwebtoken';

const token = jwt.sign({
  username: 'wisanish',
  partyId: '1-1THNN',
}, 'secret', { expiresIn: '1h' });

console.log(token);