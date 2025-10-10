OptiExacta FR — Frontend

This folder contains the single-page frontend used by the Flask backend in the project root.

Files:
- index.html — the app shell (dark theme) that talks to `/detect`, `/compare`, `/find`.
- static/css/main.css — styles
- static/js/app.js — client logic

To run the whole app, start the Flask server (project root):

```bash
# activate your venv and run
python app.py
```

Then open http://127.0.0.1:5001/ (port may vary depending on your config).  

The frontend references the logo at `/static/img/white_logo_320.png` which is kept in the original static folder.
