use std::path::PathBuf;

#[tauri::command]
fn backup_database(app_handle: tauri::AppHandle, dest_folder: String) -> Result<String, String> {
    use tauri::Manager;
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let db_path = app_data.join("ptc.db");

    if !db_path.exists() {
        return Err("Database file not found".into());
    }

    let dest = PathBuf::from(&dest_folder);
    if !dest.exists() {
        return Err("Destination folder does not exist".into());
    }

    let now = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S");
    let filename = format!("ptc_backup_{}.db", now);
    let dest_file = dest.join(&filename);

    std::fs::copy(&db_path, &dest_file).map_err(|e| e.to_string())?;

    Ok(dest_file.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![backup_database])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
