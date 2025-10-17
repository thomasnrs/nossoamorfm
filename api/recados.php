<?php
// Simple guestbook API: GET lists, POST adds {name, message, avatar(optional)}
// Stores in data/recados.json and saves avatar in uploads/avatars

error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$dataFile = __DIR__ . '/../data/recados.json';
$uploadDir = __DIR__ . '/../uploads/avatars/';

function ensureDir($path) {
    if (!is_dir($path)) { @mkdir($path, 0777, true); }
}

function ensureFile($path) {
    ensureDir(dirname($path));
    if (!file_exists($path)) { @file_put_contents($path, '[]'); }
}

function readJson($path) {
    ensureFile($path);
    $raw = @file_get_contents($path);
    $arr = json_decode($raw, true);
    return is_array($arr) ? $arr : [];
}

function writeJson($path, $arr) {
    ensureDir(dirname($path));
    $tmp = $path . '.tmp';
    @file_put_contents($tmp, json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    @rename($tmp, $path);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(readJson($dataFile), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $message = trim($_POST['message'] ?? '');

    if ($name === '' || $message === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Nome e mensagem são obrigatórios']);
        exit;
    }

    $avatarPath = null;
    // Prefer URL if provided
    $avatarUrl = trim($_POST['avatarUrl'] ?? '');
    if ($avatarUrl !== '') {
        $avatarPath = $avatarUrl;
    }
    if ($avatarPath === null && !empty($_FILES['avatar']) && is_uploaded_file($_FILES['avatar']['tmp_name'])) {
        $ext = strtolower(pathinfo($_FILES['avatar']['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg','jpeg','png','gif','webp'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Formato de imagem não suportado']);
            exit;
        }
        ensureDir($uploadDir);
        $fname = uniqid('av_') . '.' . $ext;
        $dest = $uploadDir . $fname;
        if (!@move_uploaded_file($_FILES['avatar']['tmp_name'], $dest)) {
            http_response_code(500);
            echo json_encode(['error' => 'Falha ao salvar avatar']);
            exit;
        }
        $avatarPath = 'uploads/avatars/' . $fname;
    }

    $items = readJson($dataFile);
    $items[] = [
        'id' => uniqid('msg_'),
        'name' => $name,
        'message' => $message,
        'avatar' => $avatarPath,
        'createdAt' => date('c')
    ];
    writeJson($dataFile, $items);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método não suportado']);
?>


