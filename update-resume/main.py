import os
from dotenv import load_dotenv
from perplexity import Perplexity
from datetime import datetime
import aspose.pdf as ap


load_dotenv()

# extract job description from jd.txt
jd = open("jd.txt").read()

# extract base resume latex from resume.ltx
resume = open("original-base-format.ltx").read()

resume_prompt = f"""
{jd}
this is a jd that I found, now I am giving you latex for my current resume:

{resume}

now either replace/ modify my current base resume to contain all the keywords a hr's software will look for in the resume.

Strict guidelines:
- Only generate the latex so i can directly use it to generate resume pdf.
"""
client = Perplexity()


completion = client.chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": resume_prompt,
        }
    ],
    model="sonar",
)

# ensure output directory exists
os.makedirs("output", exist_ok=True)

# build timestamp like '1_Jan_2025'
now = datetime.now()
day = str(now.day)  # no leading zero
month_abbr = now.strftime('%b')
year = now.year
timestamp = f"{day}_{month_abbr}_{year}"

output_path = f"output/generated-resume.ltx"
with open(output_path, "w") as f:
    f.write(completion.choices[0].message.content)

# now take this latex content and save it in parsed format to pdf
# try:
#     options = ap.TeXLoadOptions()
#     document = ap.Document(f"output/generated-resume.ltx", options)
#     document.save(f"output/Ujjwal-Kirti-Resume.pdf")
# except Exception as e:
#     print(e)

print(f"Resume generated and saved to {output_path}")
