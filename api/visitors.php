<?php
// Simple active visitors counter using JSON file and IP timestamps
// GET returns {active}

error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$file = __DIR__ . '/../data/visitors.json';
$ttl = 60; // seconds considered "active"

function ensureFile($path) {
  $dir = dirname($path);
  if (!is_dir($dir)) { @mkdir($dir, 0777, true); }
  if (!file_exists($path)) { @file_put_contents($path, '{}'); }
}

ensureFile($file);
$raw = @file_get_contents($file);
$map = json_decode($raw, true);
if (!is_array($map)) $map = [];

$ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$now = time();
$map[$ip] = $now;

// purge
foreach ($map as $k => $ts) {
  if ($now - intval($ts) > $ttl) unset($map[$k]);
}

@file_put_contents($file, json_encode($map));
echo json_encode([ 'active' => count($map) ]);
?>


