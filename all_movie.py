import kagglehub
import zipfile
import os 
import pandas as pd

#path = kagglehub.dataset_download("asaniczka/tmdb-movies-dataset-2023-930k-movies")
path = r"C:\Users\gulte\.cache\kagglehub\datasets\asaniczka\tmdb-movies-dataset-2023-930k-movies\versions\718"
print("Path to dataset files:", path)

print("İçerik:")
for file in os.listdir(path):
    print(" -", file)


csv_path = r"C:\Users\gulte\.cache\kagglehub\datasets\asaniczka\tmdb-movies-dataset-2023-930k-movies\versions\718\TMDB_movie_dataset_v11.csv"
df_kaggle = pd.read_csv(csv_path)

print(df_kaggle.shape)
print(df_kaggle.columns)
