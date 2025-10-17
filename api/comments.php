<?php
// Comments API for photos: GET lists, POST adds {photoId, author, comment}
// Stores in data/comments.json

error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$dataFile = __DIR__ . '/../data/comments.json';

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
    $photoId = $_GET['photoId'] ?? '';
    $items = readJson($dataFile);
    if ($photoId) {
        $items = array_filter($items, fn($item) => $item['photoId'] === $photoId);
    }
    echo json_encode(array_values($items), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? 'add';
    
    if ($action === 'delete') {
        // Admin delete
        $login = trim($_POST['login'] ?? '');
        $password = trim($_POST['password'] ?? '');
        $commentId = trim($_POST['commentId'] ?? '');
        
        if ($login !== 'foda-se' || $password !== 'meuperuhacker753159') {
            http_response_code(403);
            echo json_encode(['error' => 'Acesso negado']);
            exit;
        }
        
        if ($commentId === '') {
            http_response_code(400);
            echo json_encode(['error' => 'ID do comentário é obrigatório']);
            exit;
        }
        
        $items = readJson($dataFile);
        $items = array_filter($items, fn($item) => $item['id'] !== $commentId);
        writeJson($dataFile, array_values($items));
        echo json_encode(['ok' => true]);
        exit;
    }
    
    // Add comment
    $photoId = trim($_POST['photoId'] ?? '');
    $author = trim($_POST['author'] ?? '');
    $comment = trim($_POST['comment'] ?? '');

    if ($photoId === '' || $author === '' || $comment === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Todos os campos são obrigatórios']);
        exit;
    }

    $items = readJson($dataFile);
    $items[] = [
        'id' => uniqid('com_'),
        'photoId' => $photoId,
        'author' => $author,
        'comment' => $comment,
        'createdAt' => date('c')
    ];
    writeJson($dataFile, $items);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método não suportado']);
?>
