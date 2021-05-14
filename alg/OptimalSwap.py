import math

class OptimalSwap: 

	def __init__(self, ra=10000, rb=200000, da=1, db=100, na=3, nb=60):
		self.ra = ra	# Reserved amount of A in DEX
		self.rb = rb	# Reserved amount of B in DEX
		self.da = da	# Debt amount of A 
		self.db = db	# Debt amount of B 
		self.na = na	# Current amount of A
		self.nb = nb	# Current amount of B

	def getB(self, na, nb, ra, rb, k):
		return nb / k - na + ra / 0.997 + rb / k

	def getC(self, na, nb, ra, k):
		return ra * (nb - k * na) / (0.997 * k)

	def getParams(self):
		return self.ra, self.rb, self.da, self.db, self.na, self.nb

	# swap some A to B
	def getSwapedA(self, ra, rb, da, db, na, nb):
		k = db / da
		b = self.getB(na, nb, ra, rb, k);
		c = self.getC(na, nb, ra, k);
		return (-b + math.sqrt(b * b - 4 * c)) / 2;
		
	def getSwapedAmount(self, ra, rb, da, db, na, nb):
		fromToken = 'A';
		if (da == 0 and db == 0):
			amount = 0
		elif (na * db > nb * da):
			amount = self.getSwapedA(ra, rb, da, db, na, nb)
		else:
			fromToken = 'B'
			amount = self.getSwapedA(rb, ra, db, da, nb, na)
		
		return fromToken, amount

if __name__ == '__main__':
	# alg = OptimalSwap(ra=10000, rb=200000, da=1, db=100, na=3, nb=60);
	alg = OptimalSwap(ra=10000, rb=200000, da=0, db=10, na=3, nb=60);
	fromToken, amount = alg.getSwapedAmount(*alg.getParams())
	print(fromToken)
	print(amount)