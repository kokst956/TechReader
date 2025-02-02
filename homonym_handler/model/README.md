---
pipeline_tag: sentence-similarity
tags:
- sentence-transformers
- feature-extraction
- sentence-similarity
- transformers
---

# albert-small-kor-sbert-v1

This is a [sentence-transformers](https://www.SBERT.net) model: It maps sentences & paragraphs to a 768 dimensional dense vector space and can be used for tasks like clustering or semantic search.

[albert-small-kor-v1](https://huggingface.co/bongsoo/albert-small-kor-v1) 모델을 sentencebert로 만든 모델.


## Usage (Sentence-Transformers)

Using this model becomes easy when you have [sentence-transformers](https://www.SBERT.net) installed:

```
pip install -U sentence-transformers
```

Then you can use the model like this:

```python
from sentence_transformers import SentenceTransformer
sentences = ["This is an example sentence", "Each sentence is converted"]

model = SentenceTransformer('bongsoo/albert-small-kor-sbert-v1')
embeddings = model.encode(sentences)
print(embeddings)
```



## Usage (HuggingFace Transformers)
Without [sentence-transformers](https://www.SBERT.net), you can use the model like this: First, you pass your input through the transformer model, then you have to apply the right pooling-operation on-top of the contextualized word embeddings.

```python
from transformers import AutoTokenizer, AutoModel
import torch


def cls_pooling(model_output, attention_mask):
    return model_output[0][:,0]


# Sentences we want sentence embeddings for
sentences = ['This is an example sentence', 'Each sentence is converted']

# Load model from HuggingFace Hub
tokenizer = AutoTokenizer.from_pretrained('bongsoo/albert-small-kor-sbert-v1')
model = AutoModel.from_pretrained('bongsoo/albert-small-kor-sbert-v1')

# Tokenize sentences
encoded_input = tokenizer(sentences, padding=True, truncation=True, return_tensors='pt')

# Compute token embeddings
with torch.no_grad():
    model_output = model(**encoded_input)

# Perform pooling. In this case, cls pooling.
sentence_embeddings = cls_pooling(model_output, encoded_input['attention_mask'])

print("Sentence embeddings:")
print(sentence_embeddings)
```



## Evaluation Results

- 성능 측정을 위한 말뭉치는,  아래 한국어 (kor), 영어(en)  평가 말뭉치를 이용함
<br> 한국어 : **korsts(1,379쌍문장)** 와 **klue-sts(519쌍문장)** 
<br> 영어 : [stsb_multi_mt](https://huggingface.co/datasets/stsb_multi_mt)(1,376쌍문장) 와 [glue:stsb](https://huggingface.co/datasets/glue/viewer/stsb/validation) (1,500쌍문장)
- 성능 지표는 **cosin.spearman**
- 평가 측정 코드는 [여기](https://github.com/kobongsoo/BERT/blob/master/sbert/sbert-test3.ipynb) 참조
- 
|모델     |korsts|klue-sts|glue(stsb)|stsb_multi_mt(en)|
|:--------|------:|--------:|--------------:|------------:|
|distiluse-base-multilingual-cased-v2   |0.7475    |0.7855    |0.8193           |0.8075|
|paraphrase-multilingual-mpnet-base-v2  |0.8201    |0.7993    |0.8907           |0.8682|
|bongsoo/moco-sentencedistilbertV2.1    |0.8390    |0.8767    |0.8805           |0.8548|
|bongsoo/albert-small-kor-sbert-v1      |0.8305    |0.8588    |0.8419           |0.7965|

For an automated evaluation of this model, see the *Sentence Embeddings Benchmark*: [https://seb.sbert.net](https://seb.sbert.net?model_name={MODEL_NAME})


## Training
- [albert-small-kor-v1](https://huggingface.co/bongsoo/albert-small-kor-v1) 모델을 sts(10)-distil(10)-nli(3)-sts(10) 훈련 시킴

The model was trained with the parameters:

**공통**
- **do_lower_case=1, correct_bios=0, polling_mode=cls**
  
**1.STS**
- 말뭉치 : korsts(5,749) + kluestsV1.1(11,668) + stsb_multi_mt(5,749) + mteb/sickr-sts(9,927) + glue stsb(5,749) (총:38,842)
- Param : **lr: 1e-4, eps: 1e-6, warm_step=10%, epochs: 10, train_batch: 32, eval_batch: 64, max_token_len: 72**
- 훈련코드 [여기](https://github.com/kobongsoo/BERT/blob/master/sbert/sentece-bert-sts.ipynb) 참조
    
**2.distilation**
- 교사 모델 : paraphrase-multilingual-mpnet-base-v2(max_token_len:128)
- 말뭉치 : news_talk_en_ko_train.tsv (영어-한국어 대화-뉴스 병렬 말뭉치 : 1.38M)
- Param : **lr: 5e-5, eps: 1e-8, epochs: 10, train_batch: 32, eval/test_batch: 64, max_token_len: 128(교사모델이 128이므로 맟춰줌)**
- 훈련코드 [여기](https://github.com/kobongsoo/BERT/blob/master/sbert/sbert-distillaton.ipynb) 참조

**3.NLI**
- 말뭉치 : 훈련(967,852) : kornli(550,152), kluenli(24,998), glue-mnli(392,702) / 평가(3,519) : korsts(1,500), kluests(519), gluests(1,500) ()
- HyperParameter : **lr: 3e-5, eps: 1e-8, warm_step=10%, epochs: 3, train/eval_batch: 64, max_token_len: 128**
- 훈련코드 [여기](https://github.com/kobongsoo/BERT/blob/master/sbert/sentence-bert-nli.ipynb) 참조


## Full Model Architecture
```
SentenceTransformer(
  (0): Transformer({'max_seq_length': 256, 'do_lower_case': True}) with Transformer model: AlbertModel 
  (1): Pooling({'word_embedding_dimension': 768, 'pooling_mode_cls_token': True, 'pooling_mode_mean_tokens': False, 'pooling_mode_max_tokens': False, 'pooling_mode_mean_sqrt_len_tokens': False})
)
```

## Citing & Authors

bongsoo