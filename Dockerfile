FROM python:3.14-slim

ENV PYTHONUNBUFFERED=1
ENV PORT=5050

RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-latex-extra \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5050

CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "5050"]
