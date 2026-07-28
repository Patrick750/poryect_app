FROM python:3.14-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYCODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \ 
    && apt-get install -y libpq-dev \ 
    && rm -rf /var/lib/apt/lists/*

COPY requiremenst.txt .

RUN pip install --no-cache-dir -r requirements.txt 

COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver"]