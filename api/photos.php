<?php
// Simple photo feed API: GET lists, POST adds {photo, caption?, author?}
// Stores metadata in data/photos.json and images in uploads/photos

error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$dataFile = __DIR__ . '/../data/photos.json';
$uploadDir = __DIR__ . '/../uploads/photos/';

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
    $caption = trim($_POST['caption'] ?? '');
    $author = trim($_POST['author'] ?? '');
    $photoUrl = trim($_POST['photoUrl'] ?? '');

    $publicPath = null;
    if ($photoUrl !== '') {
        $publicPath = $photoUrl;
    } else if (!empty($_FILES['photo']) && is_uploaded_file($_FILES['photo']['tmp_name'])) {
        $ext = strtolower(pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg','jpeg','png','gif','webp'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Formato de imagem não suportado']);
            exit;
        }
        ensureDir($uploadDir);
        $fname = uniqid('ph_') . '.' . $ext;
        $dest = $uploadDir . $fname;
        if (!@move_uploaded_file($_FILES['photo']['tmp_name'], $dest)) {
            http_response_code(500);
            echo json_encode(['error' => 'Falha ao salvar foto']);
            exit;
        }
        $publicPath = 'uploads/photos/' . $fname;
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Envie um arquivo ou informe uma URL de foto']);
        exit;
    }

    $items = readJson($dataFile);
    $items[] = [
        'id' => uniqid('pic_'),
        'photo' => $publicPath,
        'caption' => $caption,
        'author' => $author,
        'createdAt' => date('c')
    ];
    writeJson($dataFile, $items);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método não suportado']);
?>


