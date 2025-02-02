from sklearn.metrics.pairwise import cosine_similarity

def homonym_handling(model, select_para, link_summary):
    """
    전달 받은 모델을 통해 summary와 original_text를 임베딩하고 cosine_similarity를 계산하여 반환하는 함수
    """
    para_encode = model.encode(select_para)
    link_encode = model.encode(link_summary)

    similarity = cosine_similarity([link_encode], [para_encode])[0][0]


    return similarity