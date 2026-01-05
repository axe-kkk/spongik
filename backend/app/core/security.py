import hashlib
import secrets


def hash_password(password: str) -> str:
    """Хеширование пароля с солью (простая реализация без bcrypt)"""
    salt = secrets.token_hex(16)
    hash_obj = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}${hash_obj.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    """Проверка пароля"""
    try:
        salt, stored_hash = password_hash.split('$')
        hash_obj = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return hash_obj.hex() == stored_hash
    except ValueError:
        return False






